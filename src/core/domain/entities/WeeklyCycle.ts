// src/core/domain/entities/WeeklyCycle.ts
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
  categoryLimitsSnapshot?: Record<string, number>;
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
  private _categoryLimitsSnapshot: Record<string, number>;

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
    this._categoryLimitsSnapshot = WeeklyCycle.sanitizeSnapshot(
      props.categoryLimitsSnapshot
    );

    if (props.transactions && props.transactions.length > 0) {
      for (const tx of props.transactions) {
        tx.applyToCycle(this);
      }
    }

    this._isClosed = Boolean(props.isClosed);
  }

  private static sanitizeSnapshot(
    raw?: Record<string, number>
  ): Record<string, number> {
    if (!raw || typeof raw !== 'object') {
      return {};
    }
    const clean: Record<string, number> = {};
    for (const [key, val] of Object.entries(raw)) {
      if (key.trim() && Number.isFinite(val) && val >= 0) {
        clean[key.trim()] = Math.round(val);
      }
    }
    return clean;
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

  public get categoryLimitsSnapshot(): Readonly<Record<string, number>> {
    return { ...this._categoryLimitsSnapshot };
  }

  /**
   * Lấy hạn mức tuần của một danh mục từ bản chụp (Snapshot) của riêng tuần này.
   * Trả về null nếu danh mục chưa có trong snapshot (để fallback về Category.weeklyLimit).
   */
  public getCategoryLimitSnapshot(categoryId: string): Money | null {
    if (Object.prototype.hasOwnProperty.call(this._categoryLimitsSnapshot, categoryId)) {
      return Money.fromAmount(this._categoryLimitsSnapshot[categoryId]);
    }
    return null;
  }

  public setCategoryLimitSnapshot(categoryId: string, limit: Money): void {
    if (limit.isNegative()) {
      throw new Error('Hạn mức tuần trong snapshot không được là số âm.');
    }
    this._categoryLimitsSnapshot[categoryId.trim()] = limit.amount;
  }

  public updateCategoryLimitsSnapshot(snapshot: Record<string, number>): void {
    this._categoryLimitsSnapshot = {
      ...this._categoryLimitsSnapshot,
      ...WeeklyCycle.sanitizeSnapshot(snapshot),
    };
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

  public get spendableBudget(): Money {
    return this._openingBalance
      .add(this._weeklyAllowance)
      .add(this._totalIncome)
      .subtract(this._totalSaving);
  }

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

  public addTransaction(transaction: Transaction): void {
    transaction.applyToCycle(this);
  }

  public registerExpense(transaction: ExpenseTransaction): void {
    if (!this.validateTransactionBeforeRegister(transaction)) return;
    this._transactions.push(transaction);
    this._totalExpense = this._totalExpense.add(transaction.amount);
  }

  public registerIncome(transaction: IncomeTransaction): void {
    if (!this.validateTransactionBeforeRegister(transaction)) return;
    this._transactions.push(transaction);
    this._totalIncome = this._totalIncome.add(transaction.amount);
  }

  public registerSaving(transaction: SavingTransaction): void {
    if (!this.validateTransactionBeforeRegister(transaction)) return;
    this._transactions.push(transaction);
    this._totalSaving = this._totalSaving.add(transaction.amount);
  }

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

  public getTotalByCategory(categoryId: string): Money {
    return this._transactions
      .filter((tx) => tx.categoryId === categoryId)
      .reduce((sum, tx) => sum.add(tx.amount), Money.zero());
  }

  public getBudgetUsagePercentage(): number {
    const budget = this.spendableBudget;
    if (!budget.isPositive()) {
      return this._totalExpense.isPositive() ? 100 : 0;
    }
    return Math.round((this._totalExpense.amount / budget.amount) * 100);
  }

  public closeCycle(): Money {
    this._isClosed = true;
    return this.remainingBalance;
  }

  public reopenCycle(): void {
    this._isClosed = false;
  }
}