import { Money } from '../value-objects/Money';
import type { TransactionType } from './Category';

export interface WeeklyCycle {
  registerExpense(transaction: ExpenseTransaction): void;
  registerIncome(transaction: IncomeTransaction): void;
  registerSaving(transaction: SavingTransaction): void;
}

export interface TransactionProps {
  id: string;
  amount: Money;
  categoryId: string;
  timestamp: Date;
  note?: string;
  createdAt?: Date;
}

export interface UpdateTransactionParams {
  amount?: Money;
  categoryId?: string;
  timestamp?: Date;
  note?: string;
}

export abstract class Transaction {
  protected readonly _id: string;
  protected _amount: Money;
  protected _categoryId: string;
  protected _timestamp: Date;
  protected _note: string;
  protected readonly _createdAt: Date;

  protected constructor(props: TransactionProps) {
    if (!props.id || !props.id.trim()) {
      throw new Error('ID giao dịch (Transaction.id) không được để trống.');
    }

    this._id = props.id.trim();
    this._amount = Transaction.validateAmount(props.amount);
    this._categoryId = Transaction.validateCategoryId(props.categoryId);
    this._timestamp = Transaction.validateDate(props.timestamp, 'timestamp');
    this._note = (props.note ?? '').trim();
    this._createdAt = props.createdAt
      ? Transaction.validateDate(props.createdAt, 'createdAt')
      : new Date();
  }

  private static validateAmount(amount: Money): Money {
    if (!amount.isPositive()) {
      throw new Error('Số tiền giao dịch phải lớn hơn 0.');
    }
    return amount;
  }

  private static validateCategoryId(categoryId: string): string {
    const trimmed = categoryId.trim();
    if (!trimmed) {
      throw new Error('Danh mục giao dịch (categoryId) không được để trống.');
    }
    return trimmed;
  }

  private static validateDate(date: Date, fieldName: string): Date {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
      throw new Error(`Trường thời gian "${fieldName}" của giao dịch không hợp lệ.`);
    }
    return new Date(date.getTime());
  }

  // Getters
  public get id(): string {
    return this._id;
  }

  public get amount(): Money {
    return this._amount;
  }

  public get categoryId(): string {
    return this._categoryId;
  }

  public get timestamp(): Date {
    return new Date(this._timestamp.getTime());
  }

  public get note(): string {
    return this._note;
  }

  public get createdAt(): Date {
    return new Date(this._createdAt.getTime());
  }

  public updateDetails(params: UpdateTransactionParams): void {
    if (params.amount !== undefined) {
      this._amount = Transaction.validateAmount(params.amount);
    }
    if (params.categoryId !== undefined) {
      this._categoryId = Transaction.validateCategoryId(params.categoryId);
    }
    if (params.timestamp !== undefined) {
      this._timestamp = Transaction.validateDate(params.timestamp, 'timestamp');
    }
    if (params.note !== undefined) {
      this._note = params.note.trim();
    }
  }

  /**
   * Phương thức đa hình xác định loại giao dịch
   */
  public abstract getType(): TransactionType;

  /**
   * Phương thức đa hình áp dụng tác động tài chính của giao dịch vào chu kỳ tuần
   */
  public abstract applyToCycle(cycle: WeeklyCycle): void;
}

/**
 * 1. Giao dịch Chi tiêu (Làm giảm số dư khả dụng trong tuần)
 */
export class ExpenseTransaction extends Transaction {
  public constructor(props: TransactionProps) {
    super(props);
  }

  public override getType(): TransactionType {
    return 'EXPENSE';
  }

  public override applyToCycle(cycle: WeeklyCycle): void {
    cycle.registerExpense(this);
  }
}

/**
 * 2. Giao dịch Thu nhập phát sinh (Làm tăng nguồn tiền khả dụng trong tuần)
 */
export class IncomeTransaction extends Transaction {
  public constructor(props: TransactionProps) {
    super(props);
  }

  public override getType(): TransactionType {
    return 'INCOME';
  }

  public override applyToCycle(cycle: WeeklyCycle): void {
    cycle.registerIncome(this);
  }
}

/**
 * 3. Giao dịch Tiết kiệm (Trích tiền từ số dư tuần sang quỹ tiết kiệm)
 */
export class SavingTransaction extends Transaction {
  public constructor(props: TransactionProps) {
    super(props);
  }

  public override getType(): TransactionType {
    return 'SAVING';
  }

  public override applyToCycle(cycle: WeeklyCycle): void {
    cycle.registerSaving(this);
  }
}