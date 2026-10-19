import { Money } from '../value-objects/Money';
import { WeekPeriod } from '../value-objects/WeekPeriod';
import {
  ExpenseTransaction,
  IncomeTransaction,
  SavingTransaction,
  Transaction,
} from './Transaction';

export interface WeeklyCycleProps {
  id: string;
  weekPeriod: WeekPeriod;
  openingBalance: Money;
  weeklyAllowance: Money;
  transactions?: Transaction[];
  isClosed?: boolean;
}

export class WeeklyCycle {
  private readonly _id: string;
  private readonly _weekPeriod: WeekPeriod;
  private _openingBalance: Money;
  private _weeklyAllowance: Money;
  private readonly _transactions: Transaction[];
  private _totalExpense: Money;
  private _totalIncome: Money;
  private _totalSaving: Money;
  private _isClosed: boolean;

  public constructor(props: WeeklyCycleProps) {
    if (!props.id || !props.id.trim()) {
      throw new Error('ID chu kỳ tuần (WeeklyCycle.id) không được để trống.');
    }
    if (props.weeklyAllowance.isNegative()) {
      throw new Error('Tiền chu cấp đầu tuần (weeklyAllowance) không được là số âm.');
    }

    this._id = props.id.trim();
    this._weekPeriod = props.weekPeriod;
    this._openingBalance = props.openingBalance;
    this._weeklyAllowance = props.weeklyAllowance;
    this._transactions = [];
    this._totalExpense = Money.zero();
    this._totalIncome = Money.zero();
    this._totalSaving = Money.zero();
    this._isClosed = false;

    if (props.transactions && props.transactions.length > 0) {
      for (const tx of props.transactions) {
        tx.applyToCycle(this);
      }
    }

    // Đặt cờ isClosed sau khi đã nạp các giao dịch lịch sử
    this._isClosed = Boolean(props.isClosed);
  }

  // Getters
  public get id(): string {
    return this._id;
  }

  public get weekPeriod(): WeekPeriod {
    return this._weekPeriod;
  }

  public get openingBalance(): Money {
    return this._openingBalance;
  }

  public get weeklyAllowance(): Money {
    return this._weeklyAllowance;
  }

  public get isClosed(): boolean {
    return this._isClosed;
  }

  public get transactions(): ReadonlyArray<Transaction> {
    return [...this._transactions].sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );
  }

  public get totalExpense(): Money {
    return this._totalExpense;
  }

  public get totalIncome(): Money {
    return this._totalIncome;
  }

  public get totalSaving(): Money {
    return this._totalSaving;
  }

  /**
   * Tổng quỹ tiền có thể chi tiêu trong tuần (Số dư đầu tuần + Chu cấp tuần + Thu nhập thêm - Tiết kiệm)
   */
  public get spendableBudget(): Money {
    return this._openingBalance
      .add(this._weeklyAllowance)
      .add(this._totalIncome)
      .subtract(this._totalSaving);
  }

  /**
   * Số dư còn lại thực tế trong tuần (spendableBudget - totalExpense)
   */
  public get remainingBalance(): Money {
    return this.spendableBudget.subtract(this._totalExpense);
  }

  private assertOpen(): void {
    if (this._isClosed) {
      throw new Error('Chu kỳ tuần đã đóng sổ, không thể chỉnh sửa hoặc thêm giao dịch.');
    }
  }

  private validateTransactionBeforeRegister(transaction: Transaction): boolean {
    this.assertOpen();

    if (!this._weekPeriod.contains(transaction.timestamp)) {
      throw new Error(
        `Thời gian giao dịch (${transaction.timestamp.toISOString()}) không nằm trong chu kỳ tuần (${this._weekPeriod.formatLabel()}).`
      );
    }

    const alreadyExists = this._transactions.some((t) => t.id === transaction.id);
    return !alreadyExists;
  }

  /**
   * Thêm giao dịch vào chu kỳ bằng cách kích hoạt đa hình applyToCycle
   */
  public addTransaction(transaction: Transaction): void {
    transaction.applyToCycle(this);
  }

  /**
   * Double-dispatch handler cho ExpenseTransaction
   */
  public registerExpense(transaction: ExpenseTransaction): void {
    if (!this.validateTransactionBeforeRegister(transaction)) return;
    this._transactions.push(transaction);
    this._totalExpense = this._totalExpense.add(transaction.amount);
  }

  /**
   * Double-dispatch handler cho IncomeTransaction
   */
  public registerIncome(transaction: IncomeTransaction): void {
    if (!this.validateTransactionBeforeRegister(transaction)) return;
    this._transactions.push(transaction);
    this._totalIncome = this._totalIncome.add(transaction.amount);
  }

  /**
   * Double-dispatch handler cho SavingTransaction
   */
  public registerSaving(transaction: SavingTransaction): void {
    if (!this.validateTransactionBeforeRegister(transaction)) return;
    this._transactions.push(transaction);
    this._totalSaving = this._totalSaving.add(transaction.amount);
  }

  /**
   * Xóa một giao dịch khỏi chu kỳ và tính toán lại tổng tiền
   */
  public removeTransaction(transactionId: string): Transaction {
    this.assertOpen();

    const index = this._transactions.findIndex((tx) => tx.id === transactionId);
    if (index === -1) {
      throw new Error(`Không tìm thấy giao dịch với ID "${transactionId}" trong chu kỳ tuần.`);
    }

    const [removed] = this._transactions.splice(index, 1);
    this.recalculateTotals();
    return removed;
  }

  private recalculateTotals(): void {
    this._totalExpense = Money.zero();
    this._totalIncome = Money.zero();
    this._totalSaving = Money.zero();

    for (const tx of this._transactions) {
      const type = tx.getType();
      if (type === 'EXPENSE') {
        this._totalExpense = this._totalExpense.add(tx.amount);
      } else if (type === 'INCOME') {
        this._totalIncome = this._totalIncome.add(tx.amount);
      } else if (type === 'SAVING') {
        this._totalSaving = this._totalSaving.add(tx.amount);
      }
    }
  }

  public updateWeeklyAllowance(newAllowance: Money): void {
    this.assertOpen();
    if (newAllowance.isNegative()) {
      throw new Error('Tiền chu cấp đầu tuần không được là số âm.');
    }
    this._weeklyAllowance = newAllowance;
  }

  public updateOpeningBalance(newOpeningBalance: Money): void {
    this.assertOpen();
    this._openingBalance = newOpeningBalance;
  }

  /**
   * Tính hạn mức chi tiêu an toàn mỗi ngày cho những ngày còn lại trong tuần
   */
  public getDailySafeSpend(currentDate: Date = new Date()): Money {
    const remaining = this.remainingBalance;
    if (!remaining.isPositive()) {
      return Money.zero();
    }
    const remainingDays = this._weekPeriod.getRemainingDaysFrom(currentDate);
    return remaining.divide(remainingDays);
  }

  /**
   * Tính tổng số tiền đã giao dịch theo một categoryId cụ thể
   */
  public getTotalByCategory(categoryId: string): Money {
    return this._transactions
      .filter((tx) => tx.categoryId === categoryId)
      .reduce((sum, tx) => sum.add(tx.amount), Money.zero());
  }

  /**
   * Phần trăm ngân sách đã chi tiêu trong tuần (0 -> 100+)
   */
  public getBudgetUsagePercentage(): number {
    const budget = this.spendableBudget;
    if (!budget.isPositive()) {
      return this._totalExpense.isPositive() ? 100 : 0;
    }
    return Math.round((this._totalExpense.amount / budget.amount) * 100);
  }

  /**
   * Đóng chu kỳ tuần và trả về số dư cuối tuần để kết chuyển sang tuần kế tiếp
   */
  public closeCycle(): Money {
    this._isClosed = true;
    return this.remainingBalance;
  }

  public reopenCycle(): void {
    this._isClosed = false;
  }
}