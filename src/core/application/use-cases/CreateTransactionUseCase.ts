import { AuditLog } from '../../domain/entities/AuditLog';
import type { TransactionType } from '../../domain/entities/Category';
import type { Transaction } from '../../domain/entities/Transaction';
import { WeeklyCycle } from '../../domain/entities/WeeklyCycle';
import type { IAuditLogRepository } from '../../domain/repositories/IAuditLogRepository';
import type { ICategoryRepository } from '../../domain/repositories/ICategoryRepository';
import type { ITransactionRepository } from '../../domain/repositories/ITransactionRepository';
import type { IWeeklyCycleRepository } from '../../domain/repositories/IWeeklyCycleRepository';
import { Money } from '../../domain/value-objects/Money';
import { WeekPeriod } from '../../domain/value-objects/WeekPeriod';
import { TransactionFactory } from '../factories/TransactionFactory';

export interface CreateTransactionInput {
  amount: number | Money;
  categoryId: string;
  type?: TransactionType;
  timestamp?: Date | string;
  note?: string;
}

export class CreateTransactionUseCase {
  public constructor(
    private readonly transactionRepository: ITransactionRepository,
    private readonly categoryRepository: ICategoryRepository,
    private readonly weeklyCycleRepository: IWeeklyCycleRepository,
    private readonly auditLogRepository: IAuditLogRepository
  ) {}

  public async execute(input: CreateTransactionInput): Promise<Transaction> {
    // 1. Kiểm tra danh mục tồn tại và chưa bị xóa mềm (archive)
    const category = await this.categoryRepository.findById(input.categoryId);
    if (!category) {
      throw new Error(`Không tìm thấy danh mục với ID "${input.categoryId}".`);
    }
    if (category.isArchived) {
      throw new Error(
        `Danh mục "${category.name}" đã được lưu trữ (archived), không thể thêm giao dịch mới.`
      );
    }

    // 2. Đảm bảo tính nhất quán giữa loại giao dịch và loại danh mục
    const resolvedType: TransactionType = input.type ?? category.type;
    if (resolvedType !== category.type) {
      throw new Error(
        `Loại giao dịch (${resolvedType}) không khớp với loại của danh mục "${category.name}" (${category.type}).`
      );
    }

    // 3. Khởi tạo đối tượng Transaction đa hình qua Factory
    const transaction = TransactionFactory.create({
      type: resolvedType,
      amount: input.amount,
      categoryId: category.id,
      timestamp: input.timestamp,
      note: input.note,
    });

    // 4. Tìm hoặc khởi tạo chu kỳ tuần (WeeklyCycle) tương ứng với thời điểm giao dịch
    const targetPeriod = WeekPeriod.fromDate(transaction.timestamp);
    let cycle = await this.weeklyCycleRepository.findByWeekPeriod(targetPeriod);

    if (!cycle) {
      cycle = new WeeklyCycle({
        id: `cycle_${targetPeriod.weekKey}`,
        weekPeriod: targetPeriod,
        openingBalance: Money.zero(),
        weeklyAllowance: Money.zero(),
      });
      // Áp dụng giao dịch đa hình vào chu kỳ mới
      transaction.applyToCycle(cycle);
      await this.weeklyCycleRepository.save(cycle);
    } else {
      // Áp dụng giao dịch đa hình vào chu kỳ hiện có
      transaction.applyToCycle(cycle);
      await this.weeklyCycleRepository.update(cycle);
    }

    // 5. Lưu giao dịch vào ITransactionRepository
    await this.transactionRepository.save(transaction);

    // 6. Ghi nhận bản ghi AuditLog
    const typeLabel = this.getVietnameseTypeLabel(resolvedType);
    const noteSuffix = transaction.note ? ` - Ghi chú: "${transaction.note}"` : '';
    const auditLog = AuditLog.create({
      id: TransactionFactory.generateId('audit'),
      action: 'CREATE',
      entityType: 'TRANSACTION',
      entityId: transaction.id,
      description: `Thêm giao dịch ${typeLabel} vào danh mục "${category.name}" với số tiền ${transaction.amount.formatVND()}${noteSuffix}.`,
      timestamp: new Date(),
    });
    await this.auditLogRepository.log(auditLog);

    return transaction;
  }

  private getVietnameseTypeLabel(type: TransactionType): string {
    switch (type) {
      case 'EXPENSE':
        return 'Chi tiêu';
      case 'INCOME':
        return 'Thu nhập';
      case 'SAVING':
        return 'Tiết kiệm';
    }
  }
}