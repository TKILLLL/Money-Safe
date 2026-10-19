// src/core/infrastructure/repositories/SupabaseRepositories.ts
import type { AuditAction, AuditLog } from '../../domain/entities/AuditLog';
import type { Category, CategoryType } from '../../domain/entities/Category';
import type { Transaction } from '../../domain/entities/Transaction';
import type { WeeklyCycle } from '../../domain/entities/WeeklyCycle';
import type { IAuditLogRepository } from '../../domain/repositories/IAuditLogRepository';
import type { ICategoryRepository } from '../../domain/repositories/ICategoryRepository';
import type { ITransactionRepository } from '../../domain/repositories/ITransactionRepository';
import type { IWeeklyCycleRepository } from '../../domain/repositories/IWeeklyCycleRepository';
import type { WeekPeriod } from '../../domain/value-objects/WeekPeriod';
import { AuditLogMapper } from '../mappers/AuditLogMapper';
import { CategoryMapper } from '../mappers/CategoryMapper';
import { TransactionMapper } from '../mappers/TransactionMapper';
import { WeeklyCycleMapper } from '../mappers/WeeklyCycleMapper';
import { LocalStorageAuditLogRepository } from './LocalStorageAuditLogRepository';
import { LocalStorageCategoryRepository } from './LocalStorageCategoryRepository';
import { LocalStorageTransactionRepository } from './LocalStorageTransactionRepository';
import { LocalStorageWeeklyCycleRepository } from './LocalStorageWeeklyCycleRepository';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

interface CategoryRow {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: CategoryType;
  weekly_limit_amount: number;
  currency: string;
  is_archived: boolean;
}

interface TransactionRow {
  id: string;
  type: CategoryType;
  amount: number;
  currency: string;
  category_id: string;
  timestamp_iso: string;
  note: string;
  created_at_iso: string;
}

interface WeeklyCycleRow {
  id: string;
  week_key: string;
  start_date_iso: string;
  opening_balance_amount: number;
  weekly_allowance_amount: number;
  currency: string;
  is_closed: boolean;
}

interface AuditLogRow {
  id: string;
  action: AuditAction;
  entity_type: string;
  entity_id: string;
  description: string;
  timestamp_iso: string;
}

/**
 * Client giao tiếp trực tiếp với Supabase PostgREST API (Không phụ thuộc thư viện ngoài)
 */
class SupabaseRestClient {
  private readonly baseUrl: string;
  private readonly anonKey: string;

  public constructor(config: SupabaseConfig) {
    this.baseUrl = config.url.replace(/\/+$/, '');
    this.anonKey = config.anonKey;
  }

  private getHeaders(extraHeaders?: Record<string, string>): HeadersInit {
    return {
      apikey: this.anonKey,
      Authorization: `Bearer ${this.anonKey}`,
      'Content-Type': 'application/json',
      ...extraHeaders,
    };
  }

  public async select<T>(table: string, queryString: string = ''): Promise<T[]> {
    const query = queryString ? `?${queryString}` : '';
    const response = await fetch(`${this.baseUrl}/rest/v1/${table}${query}`, {
      method: 'GET',
      headers: this.getHeaders(),
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Supabase SELECT error on ${table}: ${response.statusText}`);
    }
    return (await response.json()) as T[];
  }

  public async upsert<T extends object>(table: string, payload: T | T[]): Promise<void> {
    const response = await fetch(`${this.baseUrl}/rest/v1/${table}`, {
      method: 'POST',
      headers: this.getHeaders({
        Prefer: 'resolution=merge-duplicates,return=minimal',
      }),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Supabase UPSERT error on ${table}: ${response.statusText}`);
    }
  }

  public async deleteById(table: string, id: string): Promise<void> {
    const encodedId = encodeURIComponent(id);
    const response = await fetch(
      `${this.baseUrl}/rest/v1/${table}?id=eq.${encodedId}`,
      {
        method: 'DELETE',
        headers: this.getHeaders({ Prefer: 'return=minimal' }),
      }
    );

    if (!response.ok) {
      throw new Error(`Supabase DELETE error on ${table}: ${response.statusText}`);
    }
  }
}

/**
 * 1. Supabase Category Repository (Kèm LocalStorage Offline Fallback)
 */
export class SupabaseCategoryRepository implements ICategoryRepository {
  private readonly client: SupabaseRestClient;
  private readonly localFallback: LocalStorageCategoryRepository;

  public constructor(
    config: SupabaseConfig,
    localFallback: LocalStorageCategoryRepository = new LocalStorageCategoryRepository()
  ) {
    this.client = new SupabaseRestClient(config);
    this.localFallback = localFallback;
  }

  private toRow(category: Category): CategoryRow {
    const dto = CategoryMapper.toPersistence(category);
    return {
      id: dto.id,
      name: dto.name,
      icon: dto.icon,
      color: dto.color,
      type: dto.type,
      weekly_limit_amount: dto.weeklyLimitAmount,
      currency: dto.currency,
      is_archived: dto.isArchived,
    };
  }

  private fromRow(row: CategoryRow): Category {
    return CategoryMapper.toDomain({
      id: row.id,
      name: row.name,
      icon: row.icon,
      color: row.color,
      type: row.type,
      weeklyLimitAmount: Number(row.weekly_limit_amount),
      currency: row.currency || 'VND',
      isArchived: Boolean(row.is_archived),
    });
  }

  public async save(category: Category): Promise<void> {
    await this.localFallback.save(category);
    try {
      await this.client.upsert('categories', this.toRow(category));
    } catch {
      // Giữ bản ghi ở LocalStorage khi mất kết nối mạng
    }
  }

  public async update(category: Category): Promise<void> {
    await this.localFallback.update(category);
    try {
      await this.client.upsert('categories', this.toRow(category));
    } catch {
      // Giữ bản ghi ở LocalStorage khi mất kết nối mạng
    }
  }

  public async findById(id: string): Promise<Category | null> {
    try {
      const rows = await this.client.select<CategoryRow>(
        'categories',
        `id=eq.${encodeURIComponent(id)}&limit=1`
      );
      if (rows.length > 0) {
        return this.fromRow(rows[0]);
      }
    } catch {
      // Fallback xuống LocalStorage
    }
    return this.localFallback.findById(id);
  }

  public async findAll(includeArchived: boolean = false): Promise<Category[]> {
    try {
      const filter = includeArchived ? 'select=*' : 'select=*&is_archived=eq.false';
      const rows = await this.client.select<CategoryRow>('categories', filter);
      if (rows.length > 0) {
        return rows.map((r) => this.fromRow(r));
      }
    } catch {
      // Fallback xuống LocalStorage
    }
    return this.localFallback.findAll(includeArchived);
  }
}

/**
 * 2. Supabase Transaction Repository (Kèm LocalStorage Offline Fallback)
 */
export class SupabaseTransactionRepository implements ITransactionRepository {
  private readonly client: SupabaseRestClient;
  private readonly localFallback: LocalStorageTransactionRepository;

  public constructor(
    config: SupabaseConfig,
    localFallback: LocalStorageTransactionRepository = new LocalStorageTransactionRepository()
  ) {
    this.client = new SupabaseRestClient(config);
    this.localFallback = localFallback;
  }

  private toRow(tx: Transaction): TransactionRow {
    const dto = TransactionMapper.toPersistence(tx);
    return {
      id: dto.id,
      type: dto.type,
      amount: dto.amount,
      currency: dto.currency,
      category_id: dto.categoryId,
      timestamp_iso: dto.timestampISO,
      note: dto.note,
      created_at_iso: dto.createdAtISO,
    };
  }

  private fromRow(row: TransactionRow): Transaction {
    return TransactionMapper.toDomain({
      id: row.id,
      type: row.type,
      amount: Number(row.amount),
      currency: row.currency || 'VND',
      categoryId: row.category_id,
      timestampISO: row.timestamp_iso,
      note: row.note ?? '',
      createdAtISO: row.created_at_iso,
    });
  }

  public async save(transaction: Transaction): Promise<void> {
    await this.localFallback.save(transaction);
    try {
      await this.client.upsert('transactions', this.toRow(transaction));
    } catch {
      // Offline-first fallback
    }
  }

  public async update(transaction: Transaction): Promise<void> {
    await this.localFallback.update(transaction);
    try {
      await this.client.upsert('transactions', this.toRow(transaction));
    } catch {
      // Offline-first fallback
    }
  }

  public async delete(id: string): Promise<void> {
    await this.localFallback.delete(id);
    try {
      await this.client.deleteById('transactions', id);
    } catch {
      // Offline-first fallback
    }
  }

  public async findById(id: string): Promise<Transaction | null> {
    try {
      const rows = await this.client.select<TransactionRow>(
        'transactions',
        `id=eq.${encodeURIComponent(id)}&limit=1`
      );
      if (rows.length > 0) {
        return this.fromRow(rows[0]);
      }
    } catch {
      // Offline-first fallback
    }
    return this.localFallback.findById(id);
  }

  public async findByWeekPeriod(period: WeekPeriod): Promise<Transaction[]> {
    return this.findByDateRange(period.startDate, period.endDate);
  }

  public async findByDateRange(start: Date, end: Date): Promise<Transaction[]> {
    try {
      const startISO = encodeURIComponent(start.toISOString());
      const endISO = encodeURIComponent(end.toISOString());
      const query = `timestamp_iso=gte.${startISO}&timestamp_iso=lte.${endISO}&order=timestamp_iso.desc`;
      const rows = await this.client.select<TransactionRow>('transactions', query);
      if (rows.length > 0) {
        return rows.map((r) => this.fromRow(r));
      }
    } catch {
      // Offline-first fallback
    }
    return this.localFallback.findByDateRange(start, end);
  }
}

/**
 * 3. Supabase WeeklyCycle Repository (Kèm LocalStorage Offline Fallback)
 */
export class SupabaseWeeklyCycleRepository implements IWeeklyCycleRepository {
  private readonly client: SupabaseRestClient;
  private readonly transactionRepo: ITransactionRepository;
  private readonly localFallback: LocalStorageWeeklyCycleRepository;

  public constructor(
    config: SupabaseConfig,
    transactionRepo: ITransactionRepository,
    localFallback: LocalStorageWeeklyCycleRepository = new LocalStorageWeeklyCycleRepository()
  ) {
    this.client = new SupabaseRestClient(config);
    this.transactionRepo = transactionRepo;
    this.localFallback = localFallback;
  }

  private toRow(cycle: WeeklyCycle): WeeklyCycleRow {
    const dto = WeeklyCycleMapper.toPersistence(cycle);
    return {
      id: dto.id,
      week_key: dto.weekKey,
      start_date_iso: dto.startDateISO,
      opening_balance_amount: dto.openingBalanceAmount,
      weekly_allowance_amount: dto.weeklyAllowanceAmount,
      currency: dto.currency,
      is_closed: dto.isClosed,
    };
  }

  public async save(cycle: WeeklyCycle): Promise<void> {
    await this.localFallback.save(cycle);
    try {
      await this.client.upsert('weekly_cycles', this.toRow(cycle));
    } catch {
      // Offline-first fallback
    }
  }

  public async update(cycle: WeeklyCycle): Promise<void> {
    await this.save(cycle);
  }

  public async findByWeekPeriod(period: WeekPeriod): Promise<WeeklyCycle | null> {
    try {
      const weekKey = encodeURIComponent(period.weekKey);
      const rows = await this.client.select<WeeklyCycleRow>(
        'weekly_cycles',
        `week_key=eq.${weekKey}&limit=1`
      );

      if (rows.length > 0) {
        const row = rows[0];
        const weekTransactions = await this.transactionRepo.findByWeekPeriod(period);
        return WeeklyCycleMapper.toDomain({
          id: row.id,
          weekKey: row.week_key,
          startDateISO: row.start_date_iso,
          openingBalanceAmount: Number(row.opening_balance_amount),
          weeklyAllowanceAmount: Number(row.weekly_allowance_amount),
          currency: row.currency || 'VND',
          isClosed: Boolean(row.is_closed),
          transactions: weekTransactions.map((tx) =>
            TransactionMapper.toPersistence(tx)
          ),
        });
      }
    } catch {
      // Offline-first fallback
    }
    return this.localFallback.findByWeekPeriod(period);
  }

  public async findAllCycles(): Promise<WeeklyCycle[]> {
    try {
      const rows = await this.client.select<WeeklyCycleRow>(
        'weekly_cycles',
        'order=week_key.desc'
      );
      if (rows.length > 0) {
        return rows.map((row) =>
          WeeklyCycleMapper.toDomain({
            id: row.id,
            weekKey: row.week_key,
            startDateISO: row.start_date_iso,
            openingBalanceAmount: Number(row.opening_balance_amount),
            weeklyAllowanceAmount: Number(row.weekly_allowance_amount),
            currency: row.currency || 'VND',
            isClosed: Boolean(row.is_closed),
            transactions: [],
          })
        );
      }
    } catch {
      // Offline-first fallback
    }
    return this.localFallback.findAllCycles();
  }
}

/**
 * 4. Supabase AuditLog Repository (Kèm LocalStorage Offline Fallback)
 */
export class SupabaseAuditLogRepository implements IAuditLogRepository {
  private readonly client: SupabaseRestClient;
  private readonly localFallback: LocalStorageAuditLogRepository;

  public constructor(
    config: SupabaseConfig,
    localFallback: LocalStorageAuditLogRepository = new LocalStorageAuditLogRepository()
  ) {
    this.client = new SupabaseRestClient(config);
    this.localFallback = localFallback;
  }

  public async log(entry: AuditLog): Promise<void> {
    await this.localFallback.log(entry);
    try {
      const dto = AuditLogMapper.toPersistence(entry);
      const row: AuditLogRow = {
        id: dto.id,
        action: dto.action,
        entity_type: dto.entityType,
        entity_id: dto.entityId,
        description: dto.description,
        timestamp_iso: dto.timestampISO,
      };
      await this.client.upsert('audit_logs', row);
    } catch {
      // Offline-first fallback
    }
  }

  public async findByWeekPeriod(period: WeekPeriod): Promise<AuditLog[]> {
    try {
      const startISO = encodeURIComponent(period.startDate.toISOString());
      const endISO = encodeURIComponent(period.endDate.toISOString());
      const query = `timestamp_iso=gte.${startISO}&timestamp_iso=lte.${endISO}&order=timestamp_iso.desc`;
      const rows = await this.client.select<AuditLogRow>('audit_logs', query);

      if (rows.length > 0) {
        return rows.map((r) =>
          AuditLogMapper.toDomain({
            id: r.id,
            action: r.action,
            entityType: r.entity_type,
            entityId: r.entity_id,
            description: r.description,
            timestampISO: r.timestamp_iso,
          })
        );
      }
    } catch {
      // Offline-first fallback
    }
    return this.localFallback.findByWeekPeriod(period);
  }
}