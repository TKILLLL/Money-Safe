// src/components/providers/ExpenseTrackerProvider.tsx
'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { RolloverStrategyType } from '@/core/application/services/CycleRolloverService';
import type { WeeklyAnalyticsOutput } from '@/core/application/use-cases/CalculateWeeklyAnalyticsUseCase';
import type { CreateTransactionInput } from '@/core/application/use-cases/CreateTransactionUseCase';
import type {
  CreateCategoryInput,
  UpdateCategoryInput,
} from '@/core/application/use-cases/ManageCategoryUseCase';
import type { UpdateTransactionInput } from '@/core/application/use-cases/UpdateTransactionUseCase';
import type { AuditLog } from '@/core/domain/entities/AuditLog';
import type { Category, CategoryType } from '@/core/domain/entities/Category';
import type { Transaction } from '@/core/domain/entities/Transaction';
import type { WeeklyCycle } from '@/core/domain/entities/WeeklyCycle';
import { Money } from '@/core/domain/value-objects/Money';
import { WeekPeriod } from '@/core/domain/value-objects/WeekPeriod';
import { DIContainer } from '@/core/infrastructure/di/DIContainer';

export type AppTabId = 'input' | 'calendar' | 'analytics' | 'budget';

export interface SaveCategoryPayload {
  id?: string;
  name: string;
  icon: string;
  color: string;
  type: CategoryType;
  weeklyLimit?: number | Money;
}

export interface ExpenseTrackerContextValue {
  // Navigation & Time State
  activeTab: AppTabId;
  setActiveTab: (tab: AppTabId) => void;
  selectedWeek: WeekPeriod;
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  navigateWeek: (direction: 'prev' | 'next' | 'current') => void;
  isCurrentWeek: boolean;

  // Domain & Analytics State
  analytics: WeeklyAnalyticsOutput | null;
  categories: Category[];
  allCategoriesIncludingArchived: Category[];
  currentCycle: WeeklyCycle | null;
  historicalCycles: WeeklyCycle[];
  auditLogs: AuditLog[];
  isLoading: boolean;
  error: string | null;
  clearError: () => void;

  // Use Case Actions
  addTransaction: (input: CreateTransactionInput) => Promise<Transaction>;
  updateTransaction: (input: UpdateTransactionInput) => Promise<Transaction>;
  deleteTransaction: (transactionId: string) => Promise<void>;
  saveCategory: (payload: SaveCategoryPayload) => Promise<Category>;
  archiveCategory: (categoryId: string) => Promise<Category>;
  restoreCategory: (categoryId: string) => Promise<Category>;
  updateWeeklyAllowance: (
    weeklyAllowance: number | Money,
    openingBalance?: number | Money
  ) => Promise<WeeklyCycle>;
  rolloverWeek: (
    strategyType: RolloverStrategyType,
    savingCategoryId?: string
  ) => Promise<WeeklyCycle>;
  refreshData: () => Promise<void>;
}

const ExpenseTrackerContext = createContext<ExpenseTrackerContextValue | undefined>(
  undefined
);

export interface ExpenseTrackerProviderProps {
  children: React.ReactNode;
}

export const ExpenseTrackerProvider: React.FC<ExpenseTrackerProviderProps> = ({
  children,
}) => {
  const container = useMemo(() => DIContainer.getInstance(), []);

  const [activeTab, setActiveTab] = useState<AppTabId>('input');
  const [selectedDate, setSelectedDateState] = useState<Date>(() => new Date());
  const [selectedWeek, setSelectedWeek] = useState<WeekPeriod>(() =>
    WeekPeriod.fromDate(new Date())
  );

  const [analytics, setAnalytics] = useState<WeeklyAnalyticsOutput | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [allCategoriesIncludingArchived, setAllCategoriesIncludingArchived] = useState<
    Category[]
  >([]);
  const [currentCycle, setCurrentCycle] = useState<WeeklyCycle | null>(null);
  const [historicalCycles, setHistoricalCycles] = useState<WeeklyCycle[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const isCurrentWeek = useMemo(() => {
    return selectedWeek.equals(WeekPeriod.currentWeek());
  }, [selectedWeek]);

  /**
   * Đồng bộ hóa dữ liệu từ các Use Cases theo tuần và ngày đang chọn
   */
  const loadDataForSelection = useCallback(
    async (targetWeek: WeekPeriod, targetDate: Date) => {
      try {
        setIsLoading(true);
        setError(null);

        // Đảm bảo chu kỳ tuần đang xét được khởi tạo (không bao giờ xóa tuần cũ)
        const cycle = await container.manageWeeklyCycleUseCase.getOrCreateCycle({
          referenceDate: targetDate,
        });

        const [
          analyticsOutput,
          activeCats,
          allCats,
          allCycles,
          weekLogs,
        ] = await Promise.all([
          container.calculateWeeklyAnalyticsUseCase.execute(targetDate),
          container.manageCategoryUseCase.getCategories(false),
          container.manageCategoryUseCase.getCategories(true),
          container.manageWeeklyCycleUseCase.getHistoricalCycles(),
          container.auditLogRepository.findByWeekPeriod(targetWeek),
        ]);

        setCurrentCycle(cycle);
        setAnalytics(analyticsOutput);
        setCategories(activeCats);
        setAllCategoriesIncludingArchived(allCats);
        setHistoricalCycles(allCycles);
        setAuditLogs(weekLogs);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Đã xảy ra lỗi khi tải dữ liệu tài chính.';
        setError(message);
      } finally {
        setIsLoading(false);
      }
    },
    [container]
  );

  useEffect(() => {
    void loadDataForSelection(selectedWeek, selectedDate);
  }, [selectedWeek, selectedDate, loadDataForSelection]);

  /**
   * Chọn ngày cụ thể; nếu ngày nằm ngoài tuần hiện tại thì tự động chuyển sang tuần tương ứng
   */
  const setSelectedDate = useCallback(
    (date: Date) => {
      const normalizedDate = new Date(date.getTime());
      setSelectedDateState(normalizedDate);
      if (!selectedWeek.contains(normalizedDate)) {
        setSelectedWeek(WeekPeriod.fromDate(normalizedDate));
      }
    },
    [selectedWeek]
  );

  /**
   * Điều hướng sang tuần trước, tuần kế tiếp hoặc quay về tuần hiện tại
   */
  const navigateWeek = useCallback(
    (direction: 'prev' | 'next' | 'current') => {
      if (direction === 'current') {
        const now = new Date();
        setSelectedWeek(WeekPeriod.fromDate(now));
        setSelectedDateState(now);
        return;
      }

      const nextPeriod =
        direction === 'prev'
          ? selectedWeek.getPreviousWeek()
          : selectedWeek.getNextWeek();

      setSelectedWeek(nextPeriod);

      // Nếu quay về đúng tuần thực tế hiện tại, ưu tiên chọn ngày hôm nay
      const today = new Date();
      if (nextPeriod.contains(today)) {
        setSelectedDateState(today);
      } else {
        setSelectedDateState(nextPeriod.startDate);
      }
    },
    [selectedWeek]
  );

  const refreshData = useCallback(async () => {
    await loadDataForSelection(selectedWeek, selectedDate);
  }, [loadDataForSelection, selectedWeek, selectedDate]);

  /**
   * 1. Thêm giao dịch mới
   */
  const addTransaction = useCallback(
    async (input: CreateTransactionInput): Promise<Transaction> => {
      try {
        setError(null);
        const created = await container.createTransactionUseCase.execute({
          ...input,
          timestamp: input.timestamp ?? selectedDate,
        });
        await refreshData();
        return created;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Không thể tạo giao dịch.';
        setError(msg);
        throw err;
      }
    },
    [container, selectedDate, refreshData]
  );

  /**
   * 2. Cập nhật giao dịch
   */
  const updateTransaction = useCallback(
    async (input: UpdateTransactionInput): Promise<Transaction> => {
      try {
        setError(null);
        const updated = await container.updateTransactionUseCase.execute(input);
        await refreshData();
        return updated;
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'Không thể cập nhật giao dịch.';
        setError(msg);
        throw err;
      }
    },
    [container, refreshData]
  );

  /**
   * 3. Xóa giao dịch
   */
  const deleteTransaction = useCallback(
    async (transactionId: string): Promise<void> => {
      try {
        setError(null);
        await container.deleteTransactionUseCase.execute(transactionId);
        await refreshData();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Không thể xóa giao dịch.';
        setError(msg);
        throw err;
      }
    },
    [container, refreshData]
  );

  /**
   * 4. Tạo mới hoặc cập nhật Danh mục (Save Category)
   */
  const saveCategory = useCallback(
    async (payload: SaveCategoryPayload): Promise<Category> => {
      try {
        setError(null);
        const existing = payload.id
          ? allCategoriesIncludingArchived.find((c) => c.id === payload.id)
          : undefined;

        let saved: Category;
        if (existing && payload.id) {
          const updateInput: UpdateCategoryInput = {
            id: payload.id,
            name: payload.name,
            icon: payload.icon,
            color: payload.color,
            weeklyLimit: payload.weeklyLimit,
          };
          saved = await container.manageCategoryUseCase.updateCategory(updateInput);
        } else {
          const createInput: CreateCategoryInput = {
            id: payload.id,
            name: payload.name,
            icon: payload.icon,
            color: payload.color,
            type: payload.type,
            weeklyLimit: payload.weeklyLimit,
          };
          saved = await container.manageCategoryUseCase.createCategory(createInput);
        }

        await refreshData();
        return saved;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Không thể lưu danh mục.';
        setError(msg);
        throw err;
      }
    },
    [allCategoriesIncludingArchived, container, refreshData]
  );

  /**
   * 5. Lưu trữ (Xóa mềm) Danh mục
   */
  const archiveCategory = useCallback(
    async (categoryId: string): Promise<Category> => {
      try {
        setError(null);
        const archived =
          await container.manageCategoryUseCase.archiveCategory(categoryId);
        await refreshData();
        return archived;
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'Không thể lưu trữ danh mục.';
        setError(msg);
        throw err;
      }
    },
    [container, refreshData]
  );

  /**
   * 6. Khôi phục Danh mục đã xóa mềm
   */
  const restoreCategory = useCallback(
    async (categoryId: string): Promise<Category> => {
      try {
        setError(null);
        const restored =
          await container.manageCategoryUseCase.restoreCategory(categoryId);
        await refreshData();
        return restored;
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'Không thể khôi phục danh mục.';
        setError(msg);
        throw err;
      }
    },
    [container, refreshData]
  );

  /**
   * 7. Cập nhật tiền chu cấp đầu tuần (weeklyAllowance) & số dư đầu tuần
   */
  const updateWeeklyAllowance = useCallback(
    async (
      weeklyAllowance: number | Money,
      openingBalance?: number | Money
    ): Promise<WeeklyCycle> => {
      try {
        setError(null);
        const updatedCycle =
          await container.manageWeeklyCycleUseCase.updateWeeklyBudget({
            referenceDate: selectedDate,
            weeklyAllowance,
            openingBalance,
          });
        await refreshData();
        return updatedCycle;
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : 'Không thể cập nhật ngân sách chu kỳ tuần.';
        setError(msg);
        throw err;
      }
    },
    [container, selectedDate, refreshData]
  );

  /**
   * 8. Kết chuyển chu kỳ sang tuần kế tiếp theo Strategy
   */
  const rolloverWeek = useCallback(
    async (
      strategyType: RolloverStrategyType,
      savingCategoryId?: string
    ): Promise<WeeklyCycle> => {
      try {
        setError(null);
        const nextCycle =
          await container.manageWeeklyCycleUseCase.triggerManualRollover(
            selectedDate,
            strategyType,
            savingCategoryId
          );
        setSelectedWeek(nextCycle.weekPeriod);
        setSelectedDateState(nextCycle.weekPeriod.startDate);
        return nextCycle;
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : 'Không thể kết chuyển sang tuần mới.';
        setError(msg);
        throw err;
      }
    },
    [container, selectedDate]
  );

  const contextValue = useMemo<ExpenseTrackerContextValue>(
    () => ({
      activeTab,
      setActiveTab,
      selectedWeek,
      selectedDate,
      setSelectedDate,
      navigateWeek,
      isCurrentWeek,
      analytics,
      categories,
      allCategoriesIncludingArchived,
      currentCycle,
      historicalCycles,
      auditLogs,
      isLoading,
      error,
      clearError,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      saveCategory,
      archiveCategory,
      restoreCategory,
      updateWeeklyAllowance,
      rolloverWeek,
      refreshData,
    }),
    [
      activeTab,
      selectedWeek,
      selectedDate,
      setSelectedDate,
      navigateWeek,
      isCurrentWeek,
      analytics,
      categories,
      allCategoriesIncludingArchived,
      currentCycle,
      historicalCycles,
      auditLogs,
      isLoading,
      error,
      clearError,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      saveCategory,
      archiveCategory,
      restoreCategory,
      updateWeeklyAllowance,
      rolloverWeek,
      refreshData,
    ]
  );

  return (
    <ExpenseTrackerContext.Provider value={contextValue}>
      {children}
    </ExpenseTrackerContext.Provider>
  );
};

/**
 * Custom Hook truy cập dữ liệu và Use Cases của ứng dụng Quản lý chi tiêu tuần
 */
export function useExpenseTracker(): ExpenseTrackerContextValue {
  const context = useContext(ExpenseTrackerContext);
  if (!context) {
    throw new Error(
      'useExpenseTracker phải được sử dụng bên trong <ExpenseTrackerProvider />.'
    );
  }
  return context;
}