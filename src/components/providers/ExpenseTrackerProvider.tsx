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
  activeTab: AppTabId;
  setActiveTab: (tab: AppTabId) => void;
  selectedWeek: WeekPeriod;
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  navigateWeek: (direction: 'prev' | 'next' | 'current') => void;
  isCurrentWeek: boolean;

  analytics: WeeklyAnalyticsOutput | null;
  categories: Category[];
  allCategoriesIncludingArchived: Category[];
  currentCycle: WeeklyCycle | null;
  historicalCycles: WeeklyCycle[];
  auditLogs: AuditLog[];
  isLoading: boolean;
  error: string | null;
  clearError: () => void;

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

// Ngày neo cố định phục vụ pha SSR ban đầu để không lệch múi giờ/mili-giây giữa Server & Client
const SSR_FALLBACK_DATE = new Date(2026, 9, 19, 12, 0, 0, 0);

export const ExpenseTrackerProvider: React.FC<ExpenseTrackerProviderProps> = ({
  children,
}) => {
  const [isHydrated, setIsHydrated] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<AppTabId>('input');
  const [selectedDate, setSelectedDateState] = useState<Date>(SSR_FALLBACK_DATE);
  const [selectedWeek, setSelectedWeek] = useState<WeekPeriod>(() =>
    WeekPeriod.fromDate(SSR_FALLBACK_DATE)
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

  // Đánh dấu đã Hydrate trên trình duyệt và đồng bộ về ngày thực tế hiện tại
  useEffect(() => {
    const now = new Date();
    setSelectedDateState(now);
    setSelectedWeek(WeekPeriod.fromDate(now));
    setIsHydrated(true);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const isCurrentWeek = useMemo(() => {
    if (!isHydrated) return true;
    return selectedWeek.equals(WeekPeriod.currentWeek());
  }, [selectedWeek, isHydrated]);

  const loadDataForSelection = useCallback(
    async (targetWeek: WeekPeriod, targetDate: Date) => {
      const container = DIContainer.getInstance();
      try {
        setIsLoading(true);
        setError(null);

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
    []
  );

  useEffect(() => {
    if (!isHydrated) return;
    void loadDataForSelection(selectedWeek, selectedDate);
  }, [isHydrated, selectedWeek, selectedDate, loadDataForSelection]);

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
    if (!isHydrated) return;
    await loadDataForSelection(selectedWeek, selectedDate);
  }, [isHydrated, loadDataForSelection, selectedWeek, selectedDate]);

  const addTransaction = useCallback(
    async (input: CreateTransactionInput): Promise<Transaction> => {
      const container = DIContainer.getInstance();
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
    [selectedDate, refreshData]
  );

  const updateTransaction = useCallback(
    async (input: UpdateTransactionInput): Promise<Transaction> => {
      const container = DIContainer.getInstance();
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
    [refreshData]
  );

  const deleteTransaction = useCallback(
    async (transactionId: string): Promise<void> => {
      const container = DIContainer.getInstance();
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
    [refreshData]
  );

  const saveCategory = useCallback(
    async (payload: SaveCategoryPayload): Promise<Category> => {
      const container = DIContainer.getInstance();
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
    [allCategoriesIncludingArchived, refreshData]
  );

  const archiveCategory = useCallback(
    async (categoryId: string): Promise<Category> => {
      const container = DIContainer.getInstance();
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
    [refreshData]
  );

  const restoreCategory = useCallback(
    async (categoryId: string): Promise<Category> => {
      const container = DIContainer.getInstance();
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
    [refreshData]
  );

  const updateWeeklyAllowance = useCallback(
    async (
      weeklyAllowance: number | Money,
      openingBalance?: number | Money
    ): Promise<WeeklyCycle> => {
      const container = DIContainer.getInstance();
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
    [selectedDate, refreshData]
  );

  const rolloverWeek = useCallback(
    async (
      strategyType: RolloverStrategyType,
      savingCategoryId?: string
    ): Promise<WeeklyCycle> => {
      const container = DIContainer.getInstance();
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
    [selectedDate]
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
      isLoading: !isHydrated || isLoading,
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
      isHydrated,
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
      {isHydrated ? (
        children
      ) : (
        <div
          suppressHydrationWarning
          className="min-h-dvh bg-background flex items-center justify-center p-6"
        >
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-primary border-t-transparent" />
        </div>
      )}
    </ExpenseTrackerContext.Provider>
  );
};

export function useExpenseTracker(): ExpenseTrackerContextValue {
  const context = useContext(ExpenseTrackerContext);
  if (!context) {
    throw new Error(
      'useExpenseTracker phải được sử dụng bên trong <ExpenseTrackerProvider />.'
    );
  }
  return context;
}