// src/core/application/use-cases/ManageCategoryUseCase.ts
import { AuditLog } from '../../domain/entities/AuditLog';
import { Category, type CategoryType } from '../../domain/entities/Category';
import type { IAuditLogRepository } from '../../domain/repositories/IAuditLogRepository';
import type { ICategoryRepository } from '../../domain/repositories/ICategoryRepository';
import type { IWeeklyCycleRepository } from '../../domain/repositories/IWeeklyCycleRepository';
import { Money } from '../../domain/value-objects/Money';
import { WeekPeriod } from '../../domain/value-objects/WeekPeriod';
import { TransactionFactory } from '../factories/TransactionFactory';

export interface CreateCategoryInput {
  id?: string;
  name: string;
  icon: string;
  color: string;
  type: CategoryType;
  weeklyLimit?: number | Money;
  referenceDate?: Date;
}

export interface UpdateCategoryInput {
  id: string;
  name?: string;
  icon?: string;
  color?: string;
  weeklyLimit?: number | Money;
  referenceDate?: Date;
}

export class ManageCategoryUseCase {
  public constructor(
    private readonly categoryRepository: ICategoryRepository,
    private readonly auditLogRepository: IAuditLogRepository,
    private readonly weeklyCycleRepository?: IWeeklyCycleRepository
  ) {}

  private normalizeLimit(limit?: number | Money): Money {
    if (limit === undefined) {
      return Money.zero();
    }
    return limit instanceof Money ? limit : Money.fromAmount(limit);
  }

  /**
   * Khi thay đổi hạn mức 1 danh mục ở tuần referenceDate:
   * - Đóng băng hạn mức cũ cho các tuần quá khứ (< referencePeriod)
   * - Cập nhật snapshot hạn mức mới cho tuần hiện tại & tương lai (>= referencePeriod)
   */
  private async syncSnapshotFromPeriodOnwards(
    categoryId: string,
    oldLimit: Money,
    newLimit: Money,
    referenceDate: Date = new Date()
  ): Promise<void> {
    if (!this.weeklyCycleRepository) return;

    const targetPeriod = WeekPeriod.fromDate(referenceDate);
    const targetStartTime = targetPeriod.startDate.getTime();
    const allCycles = await this.weeklyCycleRepository.findAllCycles();

    for (const summaryCycle of allCycles) {
      const cycleStartTime = summaryCycle.weekPeriod.startDate.getTime();
      const fullCycle = await this.weeklyCycleRepository.findByWeekPeriod(
        summaryCycle.weekPeriod
      );
      if (!fullCycle) continue;

      if (cycleStartTime < targetStartTime) {
        // Tuần quá khứ: nếu chưa có snapshot của danh mục này thì khóa giá trị CŨ
        if (fullCycle.getCategoryLimitSnapshot(categoryId) === null) {
          fullCycle.setCategoryLimitSnapshot(categoryId, oldLimit);
          await this.weeklyCycleRepository.update(fullCycle);
        }
      } else {
        // Tuần đang xét và các tuần tương lai: cập nhật sang giá trị MỚI
        fullCycle.setCategoryLimitSnapshot(categoryId, newLimit);
        await this.weeklyCycleRepository.update(fullCycle);
      }
    }
  }

  public async createCategory(input: CreateCategoryInput): Promise<Category> {
    const existingCategories = await this.categoryRepository.findAll(true);
    const duplicate = existingCategories.find(
      (cat) =>
        cat.type === input.type &&
        cat.name.toLowerCase() === input.name.trim().toLowerCase() &&
        !cat.isArchived
    );

    if (duplicate) {
      throw new Error(`Danh mục "${input.name.trim()}" đã tồn tại trong nhóm ${input.type}.`);
    }

    const initialLimit = this.normalizeLimit(input.weeklyLimit);
    const category = new Category({
      id: input.id?.trim() ? input.id.trim() : TransactionFactory.generateId('cat'),
      name: input.name,
      icon: input.icon,
      color: input.color,
      type: input.type,
      weeklyLimit: initialLimit,
      isArchived: false,
    });

    await this.categoryRepository.save(category);
    await this.syncSnapshotFromPeriodOnwards(
      category.id,
      initialLimit,
      initialLimit,
      input.referenceDate ?? new Date()
    );

    const auditLog = AuditLog.create({
      id: TransactionFactory.generateId('audit'),
      action: 'CREATE',
      entityType: 'CATEGORY',
      entityId: category.id,
      description: `Tạo danh mục mới "${category.name}" (${category.type}) với hạn mức tuần ${category.weeklyLimit.formatVND()}.`,
      timestamp: new Date(),
    });
    await this.auditLogRepository.log(auditLog);

    return category;
  }

  public async updateCategory(input: UpdateCategoryInput): Promise<Category> {
    const category = await this.categoryRepository.findById(input.id);
    if (!category) {
      throw new Error(`Không tìm thấy danh mục với ID "${input.id}".`);
    }

    const oldName = category.name;
    const oldLimit = category.weeklyLimit;

    category.updateInfo({
      name: input.name,
      icon: input.icon,
      color: input.color,
    });

    if (input.weeklyLimit !== undefined) {
      const nextLimit = this.normalizeLimit(input.weeklyLimit);
      category.changeWeeklyLimit(nextLimit);
      await this.syncSnapshotFromPeriodOnwards(
        category.id,
        oldLimit,
        nextLimit,
        input.referenceDate ?? new Date()
      );
    }

    await this.categoryRepository.update(category);

    const auditLog = AuditLog.create({
      id: TransactionFactory.generateId('audit'),
      action: 'UPDATE',
      entityType: 'CATEGORY',
      entityId: category.id,
      description: `Cập nhật danh mục "${oldName}" -> "${category.name}", hạn mức tuần: ${oldLimit.formatVND()} -> ${category.weeklyLimit.formatVND()}.`,
      timestamp: new Date(),
    });
    await this.auditLogRepository.log(auditLog);

    return category;
  }

  public async archiveCategory(categoryId: string): Promise<Category> {
    const category = await this.categoryRepository.findById(categoryId);
    if (!category) {
      throw new Error(`Không tìm thấy danh mục cần lưu trữ với ID "${categoryId}".`);
    }

    if (category.isArchived) {
      return category;
    }

    category.archive();
    await this.categoryRepository.update(category);

    const auditLog = AuditLog.create({
      id: TransactionFactory.generateId('audit'),
      action: 'DELETE',
      entityType: 'CATEGORY',
      entityId: category.id,
      description: `Lưu trữ (xóa mềm) danh mục "${category.name}" để bảo toàn lịch sử giao dịch.`,
      timestamp: new Date(),
    });
    await this.auditLogRepository.log(auditLog);

    return category;
  }

  public async restoreCategory(categoryId: string): Promise<Category> {
    const category = await this.categoryRepository.findById(categoryId);
    if (!category) {
      throw new Error(`Không tìm thấy danh mục với ID "${categoryId}".`);
    }

    if (!category.isArchived) {
      return category;
    }

    category.unarchive();
    await this.categoryRepository.update(category);

    const auditLog = AuditLog.create({
      id: TransactionFactory.generateId('audit'),
      action: 'UPDATE',
      entityType: 'CATEGORY',
      entityId: category.id,
      description: `Khôi phục danh mục "${category.name}" về trạng thái hoạt động.`,
      timestamp: new Date(),
    });
    await this.auditLogRepository.log(auditLog);

    return category;
  }

  public async getCategories(includeArchived: boolean = false): Promise<Category[]> {
    return this.categoryRepository.findAll(includeArchived);
  }

  public async getCategoryById(categoryId: string): Promise<Category | null> {
    return this.categoryRepository.findById(categoryId);
  }
}