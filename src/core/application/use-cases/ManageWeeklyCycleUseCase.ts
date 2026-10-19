import { AuditLog } from '../../domain/entities/AuditLog';
import { WeeklyCycle } from '../../domain/entities/WeeklyCycle';
import type { IAuditLogRepository } from '../../domain/repositories/IAuditLogRepository';
import type { ICategoryRepository } from '../../domain/repositories/ICategoryRepository';
import type { ITransactionRepository } from '../../domain/repositories/ITransactionRepository';
import type { IWeeklyCycleRepository } from '../../domain/repositories/IWeeklyCycleRepository';
import { Money } from '../../domain/value-objects/Money';
import { WeekPeriod } from '../../domain/value-objects/WeekPeriod';
import { TransactionFactory } from '../factories/TransactionFactory';
import {
  CarryOverBalanceStrategy,
  CycleRolloverService,
  type RolloverStrategyType,
  TransferToSavingStrategy,
} from '../services/CycleRolloverService';

export interface EnsureWeeklyCycleOptions {
  referenceDate?: Date;
  defaultWeeklyAllowance?: number | Money;
  rolloverStrategy?: RolloverStrategyType;
  savingCategoryId?: string;
}

export interface UpdateAllowanceInput {
  referenceDate?: Date;
  weeklyAllowance: number | Money;
  openingBalance?: number | Money;
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
   * Tự động kiểm tra hoặc khởi tạo WeeklyCycle cho tuần đang xét.
   * Bảo toàn 100% lịch sử các tuần cũ để tra cứu.
   */
  public async getOrCreateCycle(
    options: EnsureWeeklyCycleOptions = {}
  ): Promise<WeeklyCycle> {
    const targetPeriod = WeekPeriod.fromDate(options.referenceDate ?? new Date());

    // 1. Kiểm tra nếu chu kỳ tuần đã tồn tại trong kho lưu trữ
    const existingCycle = await this.weeklyCycleRepository.findByWeekPeriod(targetPeriod);
    if (existingCycle) {
      return existingCycle;
    }

    // 2. Nếu chưa tồn tại, kiểm tra chu kỳ tuần liền trước để xử lý kết chuyển (nếu có)
    const previousPeriod = targetPeriod.getPreviousWeek();
    const previousCycle = await this.weeklyCycleRepository.findByWeekPeriod(previousPeriod);

    let initialOpeningBalance = Money.zero();
    let inheritedAllowance =
      options.defaultWeeklyAllowance !== undefined
        ? this.normalizeMoney(options.defaultWeeklyAllowance)
        : Money.zero();

    if (previousCycle) {
      // Kế thừa mức chu cấp hàng tuần từ tuần trước nếu người dùng chưa truyền mức mới
      if (options.defaultWeeklyAllowance === undefined) {
        inheritedAllowance = previousCycle.weeklyAllowance;
      }

      const strategyType: RolloverStrategyType = options.rolloverStrategy ?? 'CARRY_OVER';
      const strategy =
        strategyType === 'TRANSFER_TO_SAVING'
          ? new TransferToSavingStrategy(
              this.weeklyCycleRepository,
              this.transactionRepository,
              this.categoryRepository,
              this.auditLogRepository,
              options.savingCategoryId
            )
          : new CarryOverBalanceStrategy(
              this.weeklyCycleRepository,
              this.auditLogRepository
            );

      const rolloverService = new CycleRolloverService(strategy);
      const rolloverResult = await rolloverService.rolloverToNextWeek(
        previousCycle,
        targetPeriod,
        inheritedAllowance
      );

      initialOpeningBalance = rolloverResult.newCycleOpeningBalance;
    }

    // 3. Nạp các giao dịch đã phát sinh trong phạm vi tuần này (nếu có)
    const existingTransactionsInWeek =
      await this.transactionRepository.findByWeekPeriod(targetPeriod);

    const newCycle = new WeeklyCycle({
      id: `cycle_${targetPeriod.weekKey}`,
      weekPeriod: targetPeriod,
      openingBalance: initialOpeningBalance,
      weeklyAllowance: inheritedAllowance,
      transactions: existingTransactionsInWeek,
      isClosed: false,
    });

    await this.weeklyCycleRepository.save(newCycle);

    const auditLog = AuditLog.create({
      id: TransactionFactory.generateId('audit'),
      action: 'CREATE',
      entityType: 'WEEKLY_CYCLE',
      entityId: newCycle.id,
      description: `Khởi tạo chu kỳ tuần (${targetPeriod.formatLabel()}) - Số dư đầu tuần: ${initialOpeningBalance.formatVND()}, Chu cấp tuần: ${inheritedAllowance.formatVND()}.`,
      timestamp: new Date(),
    });
    await this.auditLogRepository.log(auditLog);

    return newCycle;
  }

  /**
   * Cho phép sinh viên nhập hoặc cập nhật số tiền chu cấp đầu tuần (weeklyAllowance)
   * và số dư đầu tuần (openingBalance).
   */
  public async updateWeeklyBudget(input: UpdateAllowanceInput): Promise<WeeklyCycle> {
    const cycle = await this.getOrCreateCycle({
      referenceDate: input.referenceDate,
    });

    const oldAllowance = cycle.weeklyAllowance;
    const oldOpening = cycle.openingBalance;

    const newAllowance = this.normalizeMoney(input.weeklyAllowance);
    cycle.updateWeeklyAllowance(newAllowance);

    if (input.openingBalance !== undefined) {
      cycle.updateOpeningBalance(this.normalizeMoney(input.openingBalance));
    }

    await this.weeklyCycleRepository.update(cycle);

    const auditLog = AuditLog.create({
      id: TransactionFactory.generateId('audit'),
      action: 'UPDATE',
      entityType: 'WEEKLY_CYCLE',
      entityId: cycle.id,
      description: `Cập nhật ngân sách tuần (${cycle.weekPeriod.formatLabel()}): Chu cấp tuần ${oldAllowance.formatVND()} -> ${cycle.weeklyAllowance.formatVND()}, Số dư đầu tuần ${oldOpening.formatVND()} -> ${cycle.openingBalance.formatVND()}.`,
      timestamp: new Date(),
    });
    await this.auditLogRepository.log(auditLog);

    return cycle;
  }

  /**
   * Thực hiện kết chuyển thủ công từ một tuần cụ thể sang tuần kế tiếp theo chiến lược tự chọn
   */
  public async triggerManualRollover(
    currentWeekDate: Date,
    strategyType: RolloverStrategyType,
    savingCategoryId?: string
  ): Promise<WeeklyCycle> {
    const currentPeriod = WeekPeriod.fromDate(currentWeekDate);
    const currentCycle = await this.getOrCreateCycle({ referenceDate: currentWeekDate });
    const nextPeriod = currentPeriod.getNextWeek();

    const strategy =
      strategyType === 'TRANSFER_TO_SAVING'
        ? new TransferToSavingStrategy(
            this.weeklyCycleRepository,
            this.transactionRepository,
            this.categoryRepository,
            this.auditLogRepository,
            savingCategoryId
          )
        : new CarryOverBalanceStrategy(
            this.weeklyCycleRepository,
            this.auditLogRepository
          );

    const rolloverService = new CycleRolloverService(strategy);
    const result = await rolloverService.rolloverToNextWeek(currentCycle, nextPeriod);

    const existingNextCycle = await this.weeklyCycleRepository.findByWeekPeriod(nextPeriod);
    if (existingNextCycle) {
      if (existingNextCycle.isClosed) {
        existingNextCycle.reopenCycle();
      }
      existingNextCycle.updateOpeningBalance(result.newCycleOpeningBalance);
      await this.weeklyCycleRepository.update(existingNextCycle);
      return existingNextCycle;
    }

    const nextCycle = new WeeklyCycle({
      id: `cycle_${nextPeriod.weekKey}`,
      weekPeriod: nextPeriod,
      openingBalance: result.newCycleOpeningBalance,
      weeklyAllowance: currentCycle.weeklyAllowance,
      isClosed: false,
    });
    await this.weeklyCycleRepository.save(nextCycle);
    return nextCycle;
  }

  /**
   * Lấy danh sách toàn bộ các chu kỳ tuần trong lịch sử (sắp xếp từ mới nhất đến cũ nhất)
   */
  public async getHistoricalCycles(): Promise<WeeklyCycle[]> {
    const cycles = await this.weeklyCycleRepository.findAllCycles();
    return [...cycles].sort(
      (a, b) => b.weekPeriod.startDate.getTime() - a.weekPeriod.startDate.getTime()
    );
  }
}