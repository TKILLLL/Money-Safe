// src/core/application/use-cases/ManageWeeklyCycleUseCase.ts
import { AuditLog } from '../../domain/entities/AuditLog';
import { WeeklyCycle } from '../../domain/entities/WeeklyCycle';
import type { IAuditLogRepository } from '../../domain/repositories/IAuditLogRepository';
import type { ICategoryRepository } from '../../domain/repositories/ICategoryRepository';
import type { ITransactionRepository } from '../../domain/repositories/ITransactionRepository';
import type { IWeeklyCycleRepository } from '../../domain/repositories/IWeeklyCycleRepository';
import { Money } from '../../domain/value-objects/Money';
import { WeekPeriod } from '../../domain/value-objects/WeekPeriod';
import { TransactionFactory } from '../factories/TransactionFactory';

export interface EnsureWeeklyCycleOptions {
  referenceDate?: Date;
  defaultWeeklyAllowance?: number | Money;
  defaultOpeningBalance?: number | Money;
}

export interface CategoryLimitUpdateItem {
  id: string;
  limitAmount: number;
}

export interface UpdateAllowanceInput {
  referenceDate?: Date;
  weeklyAllowance: number | Money;
  openingBalance?: number | Money;
  categoryLimits?: CategoryLimitUpdateItem[];
}

export class ManageWeeklyCycleUseCase {
  public constructor(
    private readonly weeklyCycleRepository: IWeeklyCycleRepository,
    private readonly transactionRepository: ITransactionRepository,
    private readonly categoryRepository: ICategoryRepository,
    private readonly auditLogRepository: IAuditLogRepository
  ) {}

  private normalizeMoney(value: number | Money): Money {
    return value instanceof Money ? value : Money.fromAmount(value);
  }

  /**
   * Xây dựng bản chụp (snapshot) hạn mức hiện hành từ danh sách Category
   */
  private async buildCurrentCategoriesSnapshot(): Promise<Record<string, number>> {
    const allCategories = await this.categoryRepository.findAll(true);
    const snapshot: Record<string, number> = {};
    for (const cat of allCategories) {
      snapshot[cat.id] = cat.weeklyLimit.amount;
    }
    return snapshot;
  }

  /**
   * Xoá toàn bộ dữ liệu (Làm mới về 0):
   * 1. Giữ nguyên 100% danh sách các Danh mục hiện có (id, name, icon, color, type, thứ tự).
   * 2. Đưa weeklyLimit của tất cả danh mục về 0đ (new Money(0)).
   * 3. Xoá sạch transactions, weeklyCycles cũ, auditLogs; tạo mới chu kỳ tuần hiện tại với
   *    weeklyAllowance = 0đ, openingBalance = 0đ, categoryLimitsSnapshot = 0đ.
   */
  public async resetAllDataToZero(
    referenceDate: Date = new Date()
  ): Promise<WeeklyCycle> {
    // 1. Lấy toàn bộ danh mục hiện có (bao gồm cả danh mục đã ẩn nếu có) theo đúng thứ tự hiện tại
    const existingCategories = await this.categoryRepository.findAll(true);

    // 2. Đưa hạn mức tuần (weeklyLimit) của tất cả danh mục về 0đ và tạo snapshot 0đ
    const zeroSnapshot: Record<string, number> = {};
    for (const category of existingCategories) {
      category.changeWeeklyLimit(new Money(0));
      zeroSnapshot[category.id] = 0;
    }

    // Lưu đồng loạt danh mục đã reset hạn mức về 0đ
    await this.categoryRepository.saveAll(existingCategories);

    // 3. Xóa sạch toàn bộ lịch sử giao dịch, các chu kỳ tuần cũ và nhật ký thao tác
    await Promise.all([
      this.transactionRepository.clearAll(),
      this.weeklyCycleRepository.clearAll(),
      this.auditLogRepository.clearAll(),
    ]);

    // 4. Khởi tạo mới chu kỳ tuần hiện tại với mọi thông số bằng 0đ
    const currentPeriod = WeekPeriod.fromDate(referenceDate);
    const freshZeroCycle = new WeeklyCycle({
      id: `cycle_${currentPeriod.weekKey}`,
      weekPeriod: currentPeriod,
      openingBalance: new Money(0),
      weeklyAllowance: new Money(0),
      transactions: [],
      isClosed: false,
      categoryLimitsSnapshot: zeroSnapshot,
    });

    await this.weeklyCycleRepository.save(freshZeroCycle);

    return freshZeroCycle;
  }

  /**
   * Tự động kiểm tra hoặc khởi tạo WeeklyCycle cho tuần đang xét.
   * Nếu chu kỳ đã tồn tại nhưng chưa có snapshot (dữ liệu cũ), tự động bổ sung các danh mục còn thiếu.
   */
  public async getOrCreateCycle(
    options: EnsureWeeklyCycleOptions = {}
  ): Promise<WeeklyCycle> {
    const targetPeriod = WeekPeriod.fromDate(options.referenceDate ?? new Date());
    const currentCategorySnapshot = await this.buildCurrentCategoriesSnapshot();

    // 1. Kiểm tra nếu chu kỳ tuần đã tồn tại
    const existingCycle = await this.weeklyCycleRepository.findByWeekPeriod(targetPeriod);
    if (existingCycle) {
      let needsSnapshotBackfill = false;
      const mergedSnapshot: Record<string, number> = {
        ...existingCycle.categoryLimitsSnapshot,
      };

      for (const [catId, defaultLimit] of Object.entries(currentCategorySnapshot)) {
        if (!Object.prototype.hasOwnProperty.call(mergedSnapshot, catId)) {
          mergedSnapshot[catId] = defaultLimit;
          needsSnapshotBackfill = true;
        }
      }

      if (needsSnapshotBackfill) {
        existingCycle.updateCategoryLimitsSnapshot(mergedSnapshot);
        await this.weeklyCycleRepository.update(existingCycle);
      }

      return existingCycle;
    }

    // 2. Nếu chưa tồn tại, kế thừa cấu hình mặc định từ chu kỳ gần nhất
    const allHistoricalCycles = await this.weeklyCycleRepository.findAllCycles();
    const latestConfiguredCycle = allHistoricalCycles[0] ?? null;

    const initialOpeningBalance =
      options.defaultOpeningBalance !== undefined
        ? this.normalizeMoney(options.defaultOpeningBalance)
        : latestConfiguredCycle
          ? latestConfiguredCycle.openingBalance
          : Money.zero();

    const initialWeeklyAllowance =
      options.defaultWeeklyAllowance !== undefined
        ? this.normalizeMoney(options.defaultWeeklyAllowance)
        : latestConfiguredCycle
          ? latestConfiguredCycle.weeklyAllowance
          : Money.zero();

    const transactionsInTargetWeek =
      await this.transactionRepository.findByWeekPeriod(targetPeriod);

    const newCycle = new WeeklyCycle({
      id: `cycle_${targetPeriod.weekKey}`,
      weekPeriod: targetPeriod,
      openingBalance: initialOpeningBalance,
      weeklyAllowance: initialWeeklyAllowance,
      transactions: transactionsInTargetWeek,
      isClosed: false,
      categoryLimitsSnapshot: currentCategorySnapshot,
    });

    await this.weeklyCycleRepository.save(newCycle);

    const auditLog = AuditLog.create({
      id: TransactionFactory.generateId('audit'),
      action: 'CREATE',
      entityType: 'WEEKLY_CYCLE',
      entityId: newCycle.id,
      description: `Khởi tạo chu kỳ tuần (${targetPeriod.formatLabel()}) với Chu cấp đầu tuần ${initialWeeklyAllowance.formatVND()}, Số dư đầu tuần ${initialOpeningBalance.formatVND()}.`,
      timestamp: new Date(),
    });
    await this.auditLogRepository.log(auditLog);

    return newCycle;
  }

  /**
   * Lưu cấu hình Ngân sách & Hạn mức Danh mục:
   * - Cô lập tuyệt đối các tuần quá khứ (startDate < targetPeriod.startDate).
   * - Chỉ cập nhật cho tuần đang xét (targetPeriod) và các tuần tương lai (startDate > targetPeriod.startDate).
   */
  public async updateWeeklyBudget(input: UpdateAllowanceInput): Promise<WeeklyCycle> {
    const targetDate = input.referenceDate ?? new Date();
    const targetPeriod = WeekPeriod.fromDate(targetDate);
    const targetStartTime = targetPeriod.startDate.getTime();

    const cycle = await this.getOrCreateCycle({ referenceDate: targetDate });
    const allCategories = await this.categoryRepository.findAll(true);
    const allCycles = await this.weeklyCycleRepository.findAllCycles();

    // BƯỚC A: Đóng băng (Freeze) snapshot hạn mức cũ cho tất cả các tuần QUÁ KHỨ trước khi thay đổi Category
    const oldCategoryLimitsSnapshot: Record<string, number> = {};
    for (const cat of allCategories) {
      oldCategoryLimitsSnapshot[cat.id] = cat.weeklyLimit.amount;
    }

    for (const historicalCycle of allCycles) {
      const cycleStartTime = historicalCycle.weekPeriod.startDate.getTime();
      if (cycleStartTime < targetStartTime) {
        // Tuần trong quá khứ: chỉ điền bù các danh mục chưa có trong snapshot bằng giá trị CŨ, tuyệt đối không ghi đè
        let pastNeedsFreeze = false;
        const frozenSnapshot: Record<string, number> = {
          ...historicalCycle.categoryLimitsSnapshot,
        };

        for (const [catId, oldLimit] of Object.entries(oldCategoryLimitsSnapshot)) {
          if (!Object.prototype.hasOwnProperty.call(frozenSnapshot, catId)) {
            frozenSnapshot[catId] = oldLimit;
            pastNeedsFreeze = true;
          }
        }

        if (pastNeedsFreeze) {
          const fullPastCycle = await this.weeklyCycleRepository.findByWeekPeriod(
            historicalCycle.weekPeriod
          );
          if (fullPastCycle) {
            fullPastCycle.updateCategoryLimitsSnapshot(frozenSnapshot);
            await this.weeklyCycleRepository.update(fullPastCycle);
          }
        }
      }
    }

    // BƯỚC B: Cập nhật hạn mức mới lên các Category gốc (làm cấu hình mặc định cho tương lai)
    const newSnapshot: Record<string, number> = {
      ...cycle.categoryLimitsSnapshot,
    };

    if (input.categoryLimits && input.categoryLimits.length > 0) {
      for (const item of input.categoryLimits) {
        const sanitizedLimit = Math.max(0, Math.round(item.limitAmount));
        newSnapshot[item.id] = sanitizedLimit;

        const targetCat = allCategories.find((c) => c.id === item.id);
        if (targetCat && targetCat.weeklyLimit.amount !== sanitizedLimit) {
          targetCat.changeWeeklyLimit(Money.fromAmount(sanitizedLimit));
          await this.categoryRepository.update(targetCat);
        }
      }
    }

    // BƯỚC C: Cập nhật trực tiếp cho TUẦN HIỆN TẠI ĐANG XÉT
    const oldAllowance = cycle.weeklyAllowance;
    const oldOpening = cycle.openingBalance;
    const newAllowance = this.normalizeMoney(input.weeklyAllowance);
    const newOpening =
      input.openingBalance !== undefined
        ? this.normalizeMoney(input.openingBalance)
        : cycle.openingBalance;

    cycle.updateWeeklyAllowance(newAllowance);
    if (input.openingBalance !== undefined) {
      cycle.updateOpeningBalance(newOpening);
    }
    cycle.updateCategoryLimitsSnapshot(newSnapshot);
    await this.weeklyCycleRepository.update(cycle);

    // BƯỚC D: Nếu có các tuần TƯƠNG LAI đã được khởi tạo trước đó, đồng bộ cấu hình mới cho chúng
    for (const existing of allCycles) {
      if (existing.weekPeriod.startDate.getTime() > targetStartTime) {
        const fullFutureCycle = await this.weeklyCycleRepository.findByWeekPeriod(
          existing.weekPeriod
        );
        if (fullFutureCycle && !fullFutureCycle.isClosed) {
          fullFutureCycle.updateWeeklyAllowance(newAllowance);
          if (input.openingBalance !== undefined) {
            fullFutureCycle.updateOpeningBalance(newOpening);
          }
          fullFutureCycle.updateCategoryLimitsSnapshot(newSnapshot);
          await this.weeklyCycleRepository.update(fullFutureCycle);
        }
      }
    }

    const auditLog = AuditLog.create({
      id: TransactionFactory.generateId('audit'),
      action: 'UPDATE',
      entityType: 'WEEKLY_CYCLE',
      entityId: cycle.id,
      description: `Lưu ngân sách từ tuần (${cycle.weekPeriod.formatLabel()}): Chu cấp tuần ${oldAllowance.formatVND()} -> ${cycle.weeklyAllowance.formatVND()}, Số dư đầu tuần ${oldOpening.formatVND()} -> ${cycle.openingBalance.formatVND()}. Các tuần trước đó được giữ nguyên lịch sử.`,
      timestamp: new Date(),
    });
    await this.auditLogRepository.log(auditLog);

    return cycle;
  }

  public async getHistoricalCycles(): Promise<WeeklyCycle[]> {
    const cycles = await this.weeklyCycleRepository.findAllCycles();
    return [...cycles].sort(
      (a, b) => b.weekPeriod.startDate.getTime() - a.weekPeriod.startDate.getTime()
    );
  }
}