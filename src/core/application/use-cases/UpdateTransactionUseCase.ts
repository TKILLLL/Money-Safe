import { AuditLog } from '../../domain/entities/AuditLog';
import type { Transaction } from '../../domain/entities/Transaction';
import { WeeklyCycle } from '../../domain/entities/WeeklyCycle';
import type { IAuditLogRepository } from '../../domain/repositories/IAuditLogRepository';
import type { ICategoryRepository } from '../../domain/repositories/ICategoryRepository';
import type { ITransactionRepository } from '../../domain/repositories/ITransactionRepository';
import type { IWeeklyCycleRepository } from '../../domain/repositories/IWeeklyCycleRepository';
import { Money } from '../../domain/value-objects/Money';
import { WeekPeriod } from '../../domain/value-objects/WeekPeriod';
import { TransactionFactory } from '../factories/TransactionFactory';

export interface UpdateTransactionInput {
  id: string;
  amount?: number | Money;
  categoryId?: string;
  timestamp?: Date | string;
  note?: string;
}

export class UpdateTransactionUseCase {
  public constructor(
    private readonly transactionRepository: ITransactionRepository,
    private readonly categoryRepository: ICategoryRepository,
    private readonly weeklyCycleRepository: IWeeklyCycleRepository,
    private readonly auditLogRepository: IAuditLogRepository
  ) {}

  public async execute(input: UpdateTransactionInput): Promise<Transaction> {
    // 1. Tìm giao dịch hiện tại
    const existingTx = await this.transactionRepository.findById(input.id);
    if (!existingTx) {
      throw new Error(`Không tìm thấy giao dịch cần sửa với ID "${input.id}".`);
    }

    const oldAmount = existingTx.amount;
    const oldTimestamp = existingTx.timestamp;
    const oldPeriod = WeekPeriod.fromDate(oldTimestamp);

    // 2. Xác thực danh mục đích
    const targetCategoryId = input.categoryId ?? existingTx.categoryId;
    const targetCategory = await this.categoryRepository.findById(targetCategoryId);
    if (!targetCategory) {
      throw new Error(`Không tìm thấy danh mục với ID "${targetCategoryId}".`);
    }
    if (targetCategory.isArchived && targetCategoryId !== existingTx.categoryId) {
      throw new Error(
        `Danh mục "${targetCategory.name}" đã bị lưu trữ, không thể chuyển giao dịch sang danh mục này.`
      );
    }

    // 3. Chuẩn hóa dữ liệu mới và khởi tạo lại qua Factory để đảm bảo đúng lớp đa hình (nếu đổi loại danh mục)
    const nextAmount =
      input.amount !== undefined
        ? input.amount instanceof Money
          ? input.amount
          : Money.fromAmount(input.amount)
        : existingTx.amount;

    const nextTimestamp =
      input.timestamp !== undefined
        ? input.timestamp instanceof Date
          ? new Date(input.timestamp.getTime())
          : new Date(input.timestamp)
        : existingTx.timestamp;

    const nextNote = input.note !== undefined ? input.note : existingTx.note;

    const updatedTx = TransactionFactory.create({
      id: existingTx.id,
      type: targetCategory.type,
      amount: nextAmount,
      categoryId: targetCategory.id,
      timestamp: nextTimestamp,
      note: nextNote,
      createdAt: existingTx.createdAt,
    });

    const newPeriod = WeekPeriod.fromDate(updatedTx.timestamp);

    // 4. Đồng bộ hóa với WeeklyCycle (xử lý cả trường hợp cùng tuần hoặc chuyển sang tuần khác)
    const oldCycle = await this.weeklyCycleRepository.findByWeekPeriod(oldPeriod);
    if (oldCycle) {
      const hasTxInOldCycle = oldCycle.transactions.some((t) => t.id === existingTx.id);
      if (hasTxInOldCycle) {
        oldCycle.removeTransaction(existingTx.id);
      }

      if (oldPeriod.equals(newPeriod)) {
        updatedTx.applyToCycle(oldCycle);
        await this.weeklyCycleRepository.update(oldCycle);
      } else {
        await this.weeklyCycleRepository.update(oldCycle);
      }
    }

    if (!oldPeriod.equals(newPeriod) || !oldCycle) {
      let targetCycle = await this.weeklyCycleRepository.findByWeekPeriod(newPeriod);
      if (!targetCycle) {
        targetCycle = new WeeklyCycle({
          id: `cycle_${newPeriod.weekKey}`,
          weekPeriod: newPeriod,
          openingBalance: Money.zero(),
          weeklyAllowance: Money.zero(),
        });
        updatedTx.applyToCycle(targetCycle);
        await this.weeklyCycleRepository.save(targetCycle);
      } else {
        const alreadyInTarget = targetCycle.transactions.some((t) => t.id === updatedTx.id);
        if (alreadyInTarget) {
          targetCycle.removeTransaction(updatedTx.id);
        }
        updatedTx.applyToCycle(targetCycle);
        await this.weeklyCycleRepository.update(targetCycle);
      }
    }

    // 5. Cập nhật giao dịch xuống Repository
    await this.transactionRepository.update(updatedTx);

    // 6. Ghi vết AuditLog
    const auditLog = AuditLog.create({
      id: TransactionFactory.generateId('audit'),
      action: 'UPDATE',
      entityType: 'TRANSACTION',
      entityId: updatedTx.id,
      description: `Cập nhật giao dịch danh mục "${targetCategory.name}": Số tiền ${oldAmount.formatVND()} -> ${updatedTx.amount.formatVND()}${updatedTx.note ? ` (Ghi chú: "${updatedTx.note}")` : ''}.`,
      timestamp: new Date(),
    });
    await this.auditLogRepository.log(auditLog);

    return updatedTx;
  }
}