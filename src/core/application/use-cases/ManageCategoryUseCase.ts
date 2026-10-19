import { AuditLog } from '../../domain/entities/AuditLog';
import { Category, type CategoryType } from '../../domain/entities/Category';
import type { IAuditLogRepository } from '../../domain/repositories/IAuditLogRepository';
import type { ICategoryRepository } from '../../domain/repositories/ICategoryRepository';
import { Money } from '../../domain/value-objects/Money';
import { TransactionFactory } from '../factories/TransactionFactory';

export interface CreateCategoryInput {
  id?: string;
  name: string;
  icon: string;
  color: string;
  type: CategoryType;
  weeklyLimit?: number | Money;
}

export interface UpdateCategoryInput {
  id: string;
  name?: string;
  icon?: string;
  color?: string;
  weeklyLimit?: number | Money;
}

export class ManageCategoryUseCase {
  public constructor(
    private readonly categoryRepository: ICategoryRepository,
    private readonly auditLogRepository: IAuditLogRepository
  ) {}

  private normalizeLimit(limit?: number | Money): Money {
    if (limit === undefined) {
      return Money.zero();
    }
    return limit instanceof Money ? limit : Money.fromAmount(limit);
  }

  /**
   * 1. Tạo mới danh mục thu/chi/tiết kiệm
   */
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

    const category = new Category({
      id: input.id?.trim() ? input.id.trim() : TransactionFactory.generateId('cat'),
      name: input.name,
      icon: input.icon,
      color: input.color,
      type: input.type,
      weeklyLimit: this.normalizeLimit(input.weeklyLimit),
      isArchived: false,
    });

    await this.categoryRepository.save(category);

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

  /**
   * 2. Cập nhật tên, icon, màu sắc hoặc hạn mức chi tiêu tuần của danh mục
   */
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
      category.changeWeeklyLimit(this.normalizeLimit(input.weeklyLimit));
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

  /**
   * 3. Xóa mềm (Archive) danh mục để không làm hỏng lịch sử giao dịch cũ
   */
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

  /**
   * 4. Khôi phục danh mục đã lưu trữ
   */
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

  /**
   * 5. Lấy danh sách danh mục (mặc định ẩn các danh mục đã xóa mềm)
   */
  public async getCategories(includeArchived: boolean = false): Promise<Category[]> {
    return this.categoryRepository.findAll(includeArchived);
  }

  /**
   * 6. Tìm chi tiết một danh mục theo ID
   */
  public async getCategoryById(categoryId: string): Promise<Category | null> {
    return this.categoryRepository.findById(categoryId);
  }
}