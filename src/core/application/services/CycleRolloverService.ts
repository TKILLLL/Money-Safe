import { AuditLog } from '../../domain/entities/AuditLog';
import { Category } from '../../domain/entities/Category';
import { WeeklyCycle } from '../../domain/entities/WeeklyCycle';
import type { IAuditLogRepository } from '../../domain/repositories/IAuditLogRepository';
import type { ICategoryRepository } from '../../domain/repositories/ICategoryRepository';
import type { ITransactionRepository } from '../../domain/repositories/ITransactionRepository';
import type { IWeeklyCycleRepository } from '../../domain/repositories/IWeeklyCycleRepository';
import { Money } from '../../domain/value-objects/Money';
import type { WeekPeriod } from '../../domain/value-objects/WeekPeriod';
import { TransactionFactory } from '../factories/TransactionFactory';

export type RolloverStrategyType = 'CARRY_OVER' | 'TRANSFER_TO_SAVING';

export interface RolloverContext {
  previousCycle: WeeklyCycle;
  nextPeriod: WeekPeriod;
  defaultWeeklyAllowance?: Money;
}

export interface RolloverResult {
  closedPreviousCycle: WeeklyCycle;
  newCycleOpeningBalance: Money;
  transferredToSavingAmount: Money;
  summaryMessage: string;
}

/**
 * Hợp đồng Strategy Pattern cho việc xử lý số dư cuối tuần khi sang tuần mới
 */
export interface IRolloverStrategy {
  readonly strategyType: RolloverStrategyType;
  executeRollover(context: RolloverContext): Promise<RolloverResult>;
}

/**
 * Chiến lược 1: Cộng dồn số dư tuần trước vào openingBalance của tuần mới
 */
export class CarryOverBalanceStrategy implements IRolloverStrategy {
  public readonly strategyType: RolloverStrategyType = 'CARRY_OVER';

  public constructor(
    private readonly weeklyCycleRepository: IWeeklyCycleRepository,
    private readonly auditLogRepository: IAuditLogRepository
  ) {}

  public async executeRollover(context: RolloverContext): Promise<RolloverResult> {
    const { previousCycle, nextPeriod } = context;

    const remainingToCarryOver = previousCycle.closeCycle();
    await this.weeklyCycleRepository.update(previousCycle);

    const summaryMessage = `Kết chuyển số dư ${remainingToCarryOver.formatVND()} từ tuần (${previousCycle.weekPeriod.formatLabel()}) sang số dư đầu tuần mới (${nextPeriod.formatLabel()}).`;

    const auditLog = AuditLog.create({
      id: TransactionFactory.generateId('audit'),
      action: 'UPDATE',
      entityType: 'WEEKLY_CYCLE',
      entityId: previousCycle.id,
      description: summaryMessage,
      timestamp: new Date(),
    });
    await this.auditLogRepository.log(auditLog);

    return {
      closedPreviousCycle: previousCycle,
      newCycleOpeningBalance: remainingToCarryOver,
      transferredToSavingAmount: Money.zero(),
      summaryMessage,
    };
  }
}

/**
 * Chiến lược 2: Tự động tạo giao dịch chuyển phần dư tuần trước vào danh mục Tiết kiệm,
 * và đặt openingBalance của tuần mới về 0đ.
 */
export class TransferToSavingStrategy implements IRolloverStrategy {
  public readonly strategyType: RolloverStrategyType = 'TRANSFER_TO_SAVING';

  public constructor(
    private readonly weeklyCycleRepository: IWeeklyCycleRepository,
    private readonly transactionRepository: ITransactionRepository,
    private readonly categoryRepository: ICategoryRepository,
    private readonly auditLogRepository: IAuditLogRepository,
    private readonly targetSavingCategoryId?: string
  ) {}

  public async executeRollover(context: RolloverContext): Promise<RolloverResult> {
    const { previousCycle, nextPeriod } = context;

    // Mở lại tạm thời nếu chu kỳ cũ đã đánh dấu đóng trước đó để ghi nhận giao dịch tiết kiệm cuối tuần
    if (previousCycle.isClosed) {
      previousCycle.reopenCycle();
    }

    const surplusBalance = previousCycle.remainingBalance;
    let transferredAmount = Money.zero();

    if (surplusBalance.isPositive()) {
      const savingCategory = await this.resolveSavingCategory();

      // Đặt timestamp ở thời điểm kết thúc tuần cũ (Chủ Nhật 23:59:59) để thuộc phạm vi previousCycle
      const rolloverSavingTx = TransactionFactory.create({
        type: 'SAVING',
        amount: surplusBalance,
        categoryId: savingCategory.id,
        timestamp: previousCycle.weekPeriod.endDate,
        note: `Tự động trích tiết kiệm số dư cuối tuần (${previousCycle.weekPeriod.formatLabel()})`,
      });

      rolloverSavingTx.applyToCycle(previousCycle);
      await this.transactionRepository.save(rolloverSavingTx);
      transferredAmount = surplusBalance;
    }

    previousCycle.closeCycle();
    await this.weeklyCycleRepository.update(previousCycle);

    const summaryMessage = transferredAmount.isPositive()
      ? `Tự động chuyển ${transferredAmount.formatVND()} dư cuối tuần (${previousCycle.weekPeriod.formatLabel()}) vào quỹ Tiết kiệm. Số dư đầu tuần mới (${nextPeriod.formatLabel()}) đặt về 0đ.`
      : `Đóng sổ tuần (${previousCycle.weekPeriod.formatLabel()}) không có số dư dương. Số dư đầu tuần mới (${nextPeriod.formatLabel()}) đặt về 0đ.`;

    const auditLog = AuditLog.create({
      id: TransactionFactory.generateId('audit'),
      action: 'UPDATE',
      entityType: 'WEEKLY_CYCLE',
      entityId: previousCycle.id,
      description: summaryMessage,
      timestamp: new Date(),
    });
    await this.auditLogRepository.log(auditLog);

    return {
      closedPreviousCycle: previousCycle,
      newCycleOpeningBalance: Money.zero(),
      transferredToSavingAmount: transferredAmount,
      summaryMessage,
    };
  }

  /**
   * Tìm danh mục Tiết kiệm hiện có hoặc tự động khởi tạo danh mục Tiết kiệm mặc định
   */
  private async resolveSavingCategory(): Promise<Category> {
    if (this.targetSavingCategoryId) {
      const specified = await this.categoryRepository.findById(this.targetSavingCategoryId);
      if (specified && specified.type === 'SAVING' && !specified.isArchived) {
        return specified;
      }
    }

    const allCategories = await this.categoryRepository.findAll(false);
    const existingSavingCategory = allCategories.find((cat) => cat.type === 'SAVING');
    if (existingSavingCategory) {
      return existingSavingCategory;
    }

    const defaultSavingCategory = new Category({
      id: TransactionFactory.generateId('cat_saving'),
      name: 'Tiết kiệm tích lũy',
      icon: 'PiggyBank',
      color: '#10B981',
      type: 'SAVING',
      weeklyLimit: Money.zero(),
      isArchived: false,
    });

    await this.categoryRepository.save(defaultSavingCategory);
    return defaultSavingCategory;
  }
}

/**
 * Context Service điều phối thực thi Strategy kết chuyển tuần
 */
export class CycleRolloverService {
  private strategy: IRolloverStrategy;

  public constructor(initialStrategy: IRolloverStrategy) {
    this.strategy = initialStrategy;
  }

  public setStrategy(strategy: IRolloverStrategy): void {
    this.strategy = strategy;
  }

  public getStrategy(): IRolloverStrategy {
    return this.strategy;
  }

  public async rolloverToNextWeek(
    previousCycle: WeeklyCycle,
    nextPeriod: WeekPeriod,
    defaultWeeklyAllowance?: Money
  ): Promise<RolloverResult> {
    return this.strategy.executeRollover({
      previousCycle,
      nextPeriod,
      defaultWeeklyAllowance,
    });
  }
}