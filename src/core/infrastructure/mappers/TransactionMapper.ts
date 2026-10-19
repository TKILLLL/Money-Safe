import { TransactionFactory } from '../../application/factories/TransactionFactory';
import type { TransactionType } from '../../domain/entities/Category';
import type { Transaction } from '../../domain/entities/Transaction';
import { Money } from '../../domain/value-objects/Money';

export interface TransactionPersistenceDTO {
  id: string;
  type: TransactionType;
  amount: number;
  currency: string;
  categoryId: string;
  timestampISO: string;
  note: string;
  createdAtISO: string;
}

export class TransactionMapper {
  /**
   * Chuyển từ Domain Entity sang JSON DTO để lưu trữ
   */
  public static toPersistence(entity: Transaction): TransactionPersistenceDTO {
    return {
      id: entity.id,
      type: entity.getType(),
      amount: entity.amount.amount,
      currency: entity.amount.currency,
      categoryId: entity.categoryId,
      timestampISO: entity.timestamp.toISOString(),
      note: entity.note,
      createdAtISO: entity.createdAt.toISOString(),
    };
  }

  /**
   * Khôi phục đúng instance đa hình (Expense/Income/Saving) từ JSON DTO
   */
  public static toDomain(dto: TransactionPersistenceDTO): Transaction {
    return TransactionFactory.create({
      id: dto.id,
      type: dto.type,
      amount: new Money(dto.amount, dto.currency || 'VND'),
      categoryId: dto.categoryId,
      timestamp: new Date(dto.timestampISO),
      note: dto.note,
      createdAt: new Date(dto.createdAtISO),
    });
  }
}