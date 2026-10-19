import type { Transaction } from '../entities/Transaction';
import type { WeekPeriod } from '../value-objects/WeekPeriod';

export interface ITransactionRepository {
  save(transaction: Transaction): Promise<void>;
  update(transaction: Transaction): Promise<void>;
  delete(id: string): Promise<void>;
  findById(id: string): Promise<Transaction | null>;
  findByWeekPeriod(period: WeekPeriod): Promise<Transaction[]>;
  findByDateRange(start: Date, end: Date): Promise<Transaction[]>;
}