// src/core/infrastructure/SeedData.ts
import { TransactionFactory } from '../application/factories/TransactionFactory';
import { AuditLog } from '../domain/entities/AuditLog';
import { Category } from '../domain/entities/Category';
import type { Transaction } from '../domain/entities/Transaction';
import { WeeklyCycle } from '../domain/entities/WeeklyCycle';
import { Money } from '../domain/value-objects/Money';
import { WeekPeriod } from '../domain/value-objects/WeekPeriod';
import { AuditLogMapper } from './mappers/AuditLogMapper';
import { CategoryMapper } from './mappers/CategoryMapper';
import { TransactionMapper } from './mappers/TransactionMapper';
import { WeeklyCycleMapper } from './mappers/WeeklyCycleMapper';

export const STORAGE_KEYS = {
  CATEGORIES: 'student_expense_pwa_categories_v1',
  TRANSACTIONS: 'student_expense_pwa_transactions_v1',
  WEEKLY_CYCLES: 'student_expense_pwa_weekly_cycles_v1',
  AUDIT_LOGS: 'student_expense_pwa_audit_logs_v1',
  SEED_INITIALIZED: 'student_expense_pwa_seeded_v1',
  SEED_LOCK: 'expense_tracker_seeded',
} as const;

export class SeedData {
  /**
   * Đánh dấu vĩnh viễn đã khởi tạo để chặn SeedData tự động nạp đè lại số tiền mẫu
   */
  public static markAsSeededPermanently(): void {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    window.localStorage.setItem(STORAGE_KEYS.SEED_LOCK, 'true');
    window.localStorage.setItem(STORAGE_KEYS.SEED_INITIALIZED, 'true');
  }

  /**
   * Kiểm tra và chỉ khởi tạo dữ liệu mẫu duy nhất ở lần đầu tiên mở app
   */
  public static ensureSeeded(): void {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    const isLocked = window.localStorage.getItem(STORAGE_KEYS.SEED_LOCK) === 'true';
    const isLegacySeeded =
      window.localStorage.getItem(STORAGE_KEYS.SEED_INITIALIZED) === 'true';
    const existingCategories = window.localStorage.getItem(STORAGE_KEYS.CATEGORIES);

    // Nếu đã có cờ khóa 'expense_tracker_seeded' = 'true' thì TUYỆT ĐỐI KHÔNG chạy lại SeedData
    if (isLocked || (isLegacySeeded && existingCategories)) {
      SeedData.markAsSeededPermanently();
      return;
    }

    const now = new Date();
    const currentPeriod = WeekPeriod.fromDate(now);

    // 1. Khởi tạo 8 Danh mục mặc định chuẩn nhu cầu sinh viên
    const defaultCategories = SeedData.createDefaultStudentCategories();
    const initialSnapshot: Record<string, number> = {};
    for (const cat of defaultCategories) {
      initialSnapshot[cat.id] = cat.weeklyLimit.amount;
    }

    // 2. Khởi tạo 6 Giao dịch mẫu rải đều trong tuần hiện tại
    const sampleTransactions = SeedData.createSampleTransactionsForWeek(
      currentPeriod,
      now
    );

    // 3. Khởi tạo Chu kỳ tuần hiện tại
    const currentCycle = new WeeklyCycle({
      id: `cycle_${currentPeriod.weekKey}`,
      weekPeriod: currentPeriod,
      openingBalance: Money.fromAmount(0),
      weeklyAllowance: Money.fromAmount(750_000),
      transactions: sampleTransactions,
      isClosed: false,
      categoryLimitsSnapshot: initialSnapshot,
    });

    // 4. Khởi tạo Nhật ký thao tác (AuditLog)
    const sampleAuditLogs = SeedData.createSampleAuditLogs(
      currentCycle,
      sampleTransactions,
      defaultCategories
    );

    // 5. Lưu toàn bộ xuống LocalStorage và khóa cờ Seed vĩnh viễn
    window.localStorage.setItem(
      STORAGE_KEYS.CATEGORIES,
      JSON.stringify(defaultCategories.map((c) => CategoryMapper.toPersistence(c)))
    );

    window.localStorage.setItem(
      STORAGE_KEYS.TRANSACTIONS,
      JSON.stringify(sampleTransactions.map((tx) => TransactionMapper.toPersistence(tx)))
    );

    window.localStorage.setItem(
      STORAGE_KEYS.WEEKLY_CYCLES,
      JSON.stringify([WeeklyCycleMapper.toPersistence(currentCycle)])
    );

    window.localStorage.setItem(
      STORAGE_KEYS.AUDIT_LOGS,
      JSON.stringify(sampleAuditLogs.map((log) => AuditLogMapper.toPersistence(log)))
    );

    SeedData.markAsSeededPermanently();
  }

  public static createDefaultStudentCategories(): Category[] {
    return [
      new Category({
        id: 'cat_food',
        name: 'Ăn uống',
        icon: 'Utensils',
        color: '#F97316',
        type: 'EXPENSE',
        weeklyLimit: Money.fromAmount(350_000),
      }),
      new Category({
        id: 'cat_weekly_shopping',
        name: 'Chi tiêu hàng tuần',
        icon: 'ShoppingBag',
        color: '#10B981',
        type: 'EXPENSE',
        weeklyLimit: Money.fromAmount(120_000),
      }),
      new Category({
        id: 'cat_laundry',
        name: 'Giặt ủi & giặt sấy',
        icon: 'Shirt',
        color: '#3B82F6',
        type: 'EXPENSE',
        weeklyLimit: Money.fromAmount(50_000),
      }),
      new Category({
        id: 'cat_utilities',
        name: 'Tiền điện & nước',
        icon: 'Droplets',
        color: '#06B6D4',
        type: 'EXPENSE',
        weeklyLimit: Money.fromAmount(70_000),
      }),
      new Category({
        id: 'cat_internet',
        name: 'Mạng',
        icon: 'Smartphone',
        color: '#64748B',
        type: 'EXPENSE',
        weeklyLimit: Money.fromAmount(35_000),
      }),
      new Category({
        id: 'cat_gym',
        name: 'Gym',
        icon: 'Dumbbell',
        color: '#0EA5E9',
        type: 'EXPENSE',
        weeklyLimit: Money.fromAmount(65_000),
      }),
      new Category({
        id: 'cat_incidentals',
        name: 'Chi phí phát sinh',
        icon: 'Pencil',
        color: '#EAB308',
        type: 'EXPENSE',
        weeklyLimit: Money.fromAmount(80_000),
      }),
      new Category({
        id: 'cat_saving',
        name: 'Tiết kiệm',
        icon: 'Landmark',
        color: '#84CC16',
        type: 'SAVING',
        weeklyLimit: Money.fromAmount(100_000),
      }),
    ];
  }

  public static createSampleTransactionsForWeek(
    period: WeekPeriod,
    referenceNow: Date
  ): Transaction[] {
    const monday = period.startDate;

    const buildDateInWeek = (dayOffset: number, hour: number, minute: number): Date => {
      return new Date(
        monday.getFullYear(),
        monday.getMonth(),
        monday.getDate() + dayOffset,
        hour,
        minute,
        0,
        0
      );
    };

    const todayTime = new Date(
      referenceNow.getFullYear(),
      referenceNow.getMonth(),
      referenceNow.getDate(),
      12,
      15,
      0,
      0
    );

    return [
      TransactionFactory.create({
        id: 'tx_seed_1',
        type: 'EXPENSE',
        amount: Money.fromAmount(37_000),
        categoryId: 'cat_food',
        timestamp: period.contains(todayTime) ? todayTime : buildDateInWeek(0, 8, 30),
        note: 'Cơm tấm sườn bì + Trà đá căng tin',
        createdAt: buildDateInWeek(0, 8, 35),
      }),
      TransactionFactory.create({
        id: 'tx_seed_2',
        type: 'EXPENSE',
        amount: Money.fromAmount(35_000),
        categoryId: 'cat_utilities',
        timestamp: buildDateInWeek(0, 19, 0),
        note: 'Góp tiền điện & nước phòng trọ tuần này',
        createdAt: buildDateInWeek(0, 19, 5),
      }),
      TransactionFactory.create({
        id: 'tx_seed_3',
        type: 'EXPENSE',
        amount: Money.fromAmount(35_000),
        categoryId: 'cat_laundry',
        timestamp: buildDateInWeek(1, 17, 45),
        note: 'Giặt sấy quần áo tiệm đầu ngõ (3.5kg)',
        createdAt: buildDateInWeek(1, 17, 50),
      }),
      TransactionFactory.create({
        id: 'tx_seed_4',
        type: 'EXPENSE',
        amount: Money.fromAmount(45_000),
        categoryId: 'cat_weekly_shopping',
        timestamp: buildDateInWeek(2, 10, 20),
        note: 'Mua mì gói, trứng gà & nước rửa chén',
        createdAt: buildDateInWeek(2, 10, 25),
      }),
      TransactionFactory.create({
        id: 'tx_seed_5',
        type: 'EXPENSE',
        amount: Money.fromAmount(25_000),
        categoryId: 'cat_incidentals',
        timestamp: buildDateInWeek(3, 14, 10),
        note: 'In tài liệu ôn tập môn Cấu trúc dữ liệu',
        createdAt: buildDateInWeek(3, 14, 15),
      }),
      TransactionFactory.create({
        id: 'tx_seed_6',
        type: 'SAVING',
        amount: Money.fromAmount(50_000),
        categoryId: 'cat_saving',
        timestamp: buildDateInWeek(4, 21, 0),
        note: 'Trích quỹ tiết kiệm sinh viên hàng tuần',
        createdAt: buildDateInWeek(4, 21, 5),
      }),
    ];
  }

  private static createSampleAuditLogs(
    cycle: WeeklyCycle,
    transactions: Transaction[],
    categories: Category[]
  ): AuditLog[] {
    const categoryNameMap = new Map<string, string>(
      categories.map((c) => [c.id, c.name])
    );

    const logs: AuditLog[] = [
      AuditLog.create({
        id: 'audit_seed_cycle',
        action: 'CREATE',
        entityType: 'WEEKLY_CYCLE',
        entityId: cycle.id,
        description: `Khởi tạo chu kỳ tuần (${cycle.weekPeriod.formatLabel()}) với tiền chu cấp đầu tuần ${cycle.weeklyAllowance.formatVND()}.`,
        timestamp: cycle.weekPeriod.startDate,
      }),
    ];

    transactions.forEach((tx, index) => {
      const catName = categoryNameMap.get(tx.categoryId) ?? 'Danh mục';
      logs.push(
        AuditLog.create({
          id: `audit_seed_tx_${index + 1}`,
          action: 'CREATE',
          entityType: 'TRANSACTION',
          entityId: tx.id,
          description: `Thêm giao dịch "${catName}" với số tiền ${tx.amount.formatVND()} - Ghi chú: "${tx.note}".`,
          timestamp: tx.timestamp,
        })
      );
    });

    return logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }
}