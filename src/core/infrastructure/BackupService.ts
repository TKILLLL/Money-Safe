// src/core/infrastructure/BackupService.ts
import {
  AuditLogMapper,
  type AuditLogPersistenceDTO,
} from './mappers/AuditLogMapper';
import {
  CategoryMapper,
  type CategoryPersistenceDTO,
} from './mappers/CategoryMapper';
import {
  TransactionMapper,
  type TransactionPersistenceDTO,
} from './mappers/TransactionMapper';
import {
  WeeklyCycleMapper,
  type WeeklyCyclePersistenceDTO,
} from './mappers/WeeklyCycleMapper';
import { STORAGE_KEYS } from './SeedData';

export interface UniSpendBackupPayload {
  appName: 'UniSpend';
  version: '1.0.0';
  exportedAtISO: string;
  categories: CategoryPersistenceDTO[];
  weeklyCycles: WeeklyCyclePersistenceDTO[];
  transactions: TransactionPersistenceDTO[];
  auditLogs: AuditLogPersistenceDTO[];
}

export interface BackupImportSummary {
  categoriesCount: number;
  weeklyCyclesCount: number;
  transactionsCount: number;
  auditLogsCount: number;
}

export class BackupService {
  private static isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  }

  private static safeParseArray<T>(raw: string | null): T[] {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }

  /**
   * Đóng gói toàn bộ dữ liệu hiện tại thành chuỗi JSON chuẩn hóa
   */
  public static exportToJsonString(): string {
    if (!BackupService.isBrowser()) {
      throw new Error('Tính năng sao lưu chỉ khả dụng trên trình duyệt.');
    }

    const payload: UniSpendBackupPayload = {
      appName: 'UniSpend',
      version: '1.0.0',
      exportedAtISO: new Date().toISOString(),
      categories: BackupService.safeParseArray<CategoryPersistenceDTO>(
        window.localStorage.getItem(STORAGE_KEYS.CATEGORIES)
      ),
      weeklyCycles: BackupService.safeParseArray<WeeklyCyclePersistenceDTO>(
        window.localStorage.getItem(STORAGE_KEYS.WEEKLY_CYCLES)
      ),
      transactions: BackupService.safeParseArray<TransactionPersistenceDTO>(
        window.localStorage.getItem(STORAGE_KEYS.TRANSACTIONS)
      ),
      auditLogs: BackupService.safeParseArray<AuditLogPersistenceDTO>(
        window.localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS)
      ),
    };

    return JSON.stringify(payload, null, 2);
  }

  /**
   * Tải xuống file sao lưu .json trực tiếp trên iPhone / MacBook
   */
  public static triggerDownloadBackup(): void {
    const jsonContent = BackupService.exportToJsonString();
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');

    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `unispend-backup-${y}-${m}-${d}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  /**
   * Kiểm tra tính hợp lệ qua Domain Mappers và khôi phục dữ liệu từ chuỗi JSON
   */
  public static importFromJsonString(jsonString: string): BackupImportSummary {
    if (!BackupService.isBrowser()) {
      throw new Error('Tính năng khôi phục chỉ khả dụng trên trình duyệt.');
    }

    let parsed: Partial<UniSpendBackupPayload>;
    try {
      parsed = JSON.parse(jsonString) as Partial<UniSpendBackupPayload>;
    } catch {
      throw new Error('File JSON không đúng định dạng hoặc bị hỏng.');
    }

    if (
      !parsed ||
      !Array.isArray(parsed.categories) ||
      !Array.isArray(parsed.transactions) ||
      !Array.isArray(parsed.weeklyCycles)
    ) {
      throw new Error(
        'Cấu trúc file sao lưu không hợp lệ (thiếu categories, transactions hoặc weeklyCycles).'
      );
    }

    const validCategories = parsed.categories.map((dto) =>
      CategoryMapper.toPersistence(CategoryMapper.toDomain(dto))
    );
    const validTransactions = parsed.transactions.map((dto) =>
      TransactionMapper.toPersistence(TransactionMapper.toDomain(dto))
    );
    const validCycles = parsed.weeklyCycles.map((dto) =>
      WeeklyCycleMapper.toPersistence(WeeklyCycleMapper.toDomain(dto))
    );
    const validAuditLogs = Array.isArray(parsed.auditLogs)
      ? parsed.auditLogs.map((dto) =>
          AuditLogMapper.toPersistence(AuditLogMapper.toDomain(dto))
        )
      : [];

    window.localStorage.setItem(
      STORAGE_KEYS.CATEGORIES,
      JSON.stringify(validCategories)
    );
    window.localStorage.setItem(
      STORAGE_KEYS.TRANSACTIONS,
      JSON.stringify(validTransactions)
    );
    window.localStorage.setItem(
      STORAGE_KEYS.WEEKLY_CYCLES,
      JSON.stringify(validCycles)
    );
    window.localStorage.setItem(
      STORAGE_KEYS.AUDIT_LOGS,
      JSON.stringify(validAuditLogs)
    );
    window.localStorage.setItem(STORAGE_KEYS.SEED_INITIALIZED, 'true');

    return {
      categoriesCount: validCategories.length,
      weeklyCyclesCount: validCycles.length,
      transactionsCount: validTransactions.length,
      auditLogsCount: validAuditLogs.length,
    };
  }

  /**
   * Xóa sạch toàn bộ giao dịch, chu kỳ tuần và nhật ký về 0đ (LocalStorage + Supabase)
   * Giữ lại danh mục mặc định và chặn SeedData tự nạp lại dữ liệu mẫu.
   */
  public static async resetAllData(): Promise<void> {
    if (!BackupService.isBrowser()) return;

    // 1. Xóa sạch giao dịch, chu kỳ tuần và log ở LocalStorage nhưng giữ cờ SEED_INITIALIZED = 'true'
    window.localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify([]));
    window.localStorage.setItem(STORAGE_KEYS.WEEKLY_CYCLES, JSON.stringify([]));
    window.localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify([]));
    window.localStorage.setItem(STORAGE_KEYS.SEED_INITIALIZED, 'true');

    // 2. Nếu có kết nối Supabase Cloud thì xóa luôn trên đám mây
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()?.replace(/\/+$/, '');
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

    if (supabaseUrl && supabaseAnonKey) {
      const headers: HeadersInit = {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
        Prefer: 'return=minimal',
      };

      await Promise.allSettled([
        fetch(`${supabaseUrl}/rest/v1/transactions?id=neq.__none__`, {
          method: 'DELETE',
          headers,
        }),
        fetch(`${supabaseUrl}/rest/v1/weekly_cycles?id=neq.__none__`, {
          method: 'DELETE',
          headers,
        }),
        fetch(`${supabaseUrl}/rest/v1/audit_logs?id=neq.__none__`, {
          method: 'DELETE',
          headers,
        }),
      ]);
    }
  }
}