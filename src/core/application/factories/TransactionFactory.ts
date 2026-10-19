import type { TransactionType } from '../../domain/entities/Category';
import {
  ExpenseTransaction,
  IncomeTransaction,
  SavingTransaction,
  Transaction,
  type TransactionProps,
} from '../../domain/entities/Transaction';
import { Money } from '../../domain/value-objects/Money';

export interface CreateTransactionDTO {
  id?: string;
  type: TransactionType;
  amount: number | Money;
  categoryId: string;
  timestamp?: Date | string;
  note?: string;
  createdAt?: Date | string;
}

export class TransactionFactory {
  /**
   * Sinh ID duy nhất an toàn trên cả môi trường Browser và Node.js
   */
  public static generateId(prefix: string = 'tx'): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `${prefix}_${crypto.randomUUID()}`;
    }
    const randomPart = Math.random().toString(36).substring(2, 10);
    return `${prefix}_${Date.now()}_${randomPart}`;
  }

  private static normalizeMoney(amount: number | Money): Money {
    return amount instanceof Money ? amount : Money.fromAmount(amount);
  }

  private static normalizeDate(value?: Date | string): Date {
    if (!value) {
      return new Date();
    }
    const parsed = value instanceof Date ? new Date(value.getTime()) : new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error(`Giá trị ngày tháng "${String(value)}" không hợp lệ.`);
    }
    return parsed;
  }

  /**
   * Khởi tạo đúng instance đa hình của Transaction dựa vào trường `type`
   */
  public static create(dto: CreateTransactionDTO): Transaction {
    const props: TransactionProps = {
      id: dto.id?.trim() ? dto.id.trim() : TransactionFactory.generateId('tx'),
      amount: TransactionFactory.normalizeMoney(dto.amount),
      categoryId: dto.categoryId,
      timestamp: TransactionFactory.normalizeDate(dto.timestamp),
      note: dto.note ?? '',
      createdAt: dto.createdAt
        ? TransactionFactory.normalizeDate(dto.createdAt)
        : new Date(),
    };

    switch (dto.type) {
      case 'EXPENSE':
        return new ExpenseTransaction(props);
      case 'INCOME':
        return new IncomeTransaction(props);
      case 'SAVING':
        return new SavingTransaction(props);
      default: {
        const exhaustiveCheck: never = dto.type;
        throw new Error(`Loại giao dịch không được hỗ trợ: ${String(exhaustiveCheck)}`);
      }
    }
  }

  /**
   * Hỗ trợ gọi qua instance khi inject TransactionFactory vào Use Case
   */
  public createTransaction(dto: CreateTransactionDTO): Transaction {
    return TransactionFactory.create(dto);
  }
}