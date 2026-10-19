import { AuditLog } from '../../domain/entities/AuditLog';
import type { IAuditLogRepository } from '../../domain/repositories/IAuditLogRepository';
import type { ICategoryRepository } from '../../domain/repositories/ICategoryRepository';
import type { ITransactionRepository } from '../../domain/repositories/ITransactionRepository';
import type { IWeeklyCycleRepository } from '../../domain/repositories/IWeeklyCycleRepository';
import { WeekPeriod } from '../../domain/value-objects/WeekPeriod';
import { TransactionFactory } from '../factories/TransactionFactory';

export class DeleteTransactionUseCase {
  public constructor(
    private readonly transactionRepository: ITransactionRepository,
    private readonly weeklyCycleRepository: IWeeklyCycleRepository,
    private readonly auditLogRepository: IAuditLogRepository,
    private readonly categoryRepository?: ICategoryRepository
  ) {}

  public async execute(transactionId: string): Promise<void> {
    // 1. Kiểm tra giao dịch tồn tại
    const existingTx = await this.transactionRepository.findById(transactionId);
    if (!existingTx) {
      throw new Error(`Không tìm thấy giao dịch cần xóa với ID "${transactionId}".`);
    }

    // 2. Gỡ giao dịch khỏi WeeklyCycle tương ứng để tính lại số dư tuần
    const period = WeekPeriod.fromDate(existingTx.timestamp);
    const cycle = await this.weeklyCycleRepository.findByWeekPeriod(period);

    if (cycle) {
      const existsInCycle = cycle.transactions.some((tx) => tx.id === existingTx.id);
      if (existsInCycle) {
        cycle.removeTransaction(existingTx.id);
        await this.weeklyCycleRepository.update(cycle);
      }
    }

    // 3. Xóa giao dịch khỏi ITransactionRepository
    await this.transactionRepository.delete(existingTx.id);

    // 4. Lấy tên danh mục (nếu có) để mô tả AuditLog rõ ràng hơn
    let categoryLabel = existingTx.categoryId;
    if (this.categoryRepository) {
      const category = await this.categoryRepository.findById(existingTx.categoryId);
      if (category) {
        categoryLabel = category.name;
      }
    }

    // 5. Ghi nhận bản ghi AuditLog
    const auditLog = AuditLog.create({
      id: TransactionFactory.generateId('audit'),
      action: 'DELETE',
      entityType: 'TRANSACTION',
      entityId: existingTx.id,
      description: `Xóa giao dịch thuộc danh mục "${categoryLabel}" với số tiền ${existingTx.amount.formatVND()}${existingTx.note ? ` (Ghi chú: "${existingTx.note}")` : ''}.`,
      timestamp: new Date(),
    });
    await this.auditLogRepository.log(auditLog);
  }
}