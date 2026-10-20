// src/core/application/use-cases/CalculateWeeklyAnalyticsUseCase.ts
import type { Category, CategoryType } from '../../domain/entities/Category';
import type { Transaction } from '../../domain/entities/Transaction';
import type { WeeklyCycle } from '../../domain/entities/WeeklyCycle';
import type { ICategoryRepository } from '../../domain/repositories/ICategoryRepository';
import type { ITransactionRepository } from '../../domain/repositories/ITransactionRepository';
import type { IWeeklyCycleRepository } from '../../domain/repositories/IWeeklyCycleRepository';
import { Money } from '../../domain/value-objects/Money';
import { WeekPeriod } from '../../domain/value-objects/WeekPeriod';

/**
 * 1. DTO cho Tóm tắt Tuần (Weekly Summary)
 */
export interface WeeklySummaryMetrics {
  openingBalance: Money;           // Số dư đầu tuần
  weeklyAllowance: Money;          // Chu cấp đầu tuần
  totalOtherIncome: Money;         // Thu nhập khác trong tuần
  totalWeeklyAvailable: Money;     // OpeningBalance + WeeklyAllowance + TotalOtherIncome
  totalExpenseOnly: Money;         // Tổng chi tiêu thực tế (EXPENSE)
  totalSavingAllocated: Money;     // Tổng tiền trích vào Tiết kiệm (SAVING)
  totalWeeklyExpense: Money;       // Tổng chi trong tuần (bao gồm cả Tiết kiệm phân bổ)
  remainingWeeklyBalance: Money;   // TotalWeeklyAvailable - TotalWeeklyExpense (Số dư hiện tại)
  weeklyUsagePercentage: number;   // % ngân sách tuần đã sử dụng (0 -> 100+)
}

/**
 * 2. DTO cho Biểu đồ Tròn (Donut Chart)
 */
export interface CategoryBreakdownItem {
  categoryId: string;
  categoryName: string;
  icon: string;
  color: string;
  type: CategoryType;
  amount: Money;
  percentage: number;              // Tỷ trọng % (0 -> 100)
  transactionCount: number;
}

/**
 * 3. DTO cho Biểu đồ Cột (Bar Chart: Thứ 2 -> Chủ Nhật)
 */
export interface DailySpendingBarItem {
  date: Date;
  dateKey: string;                 // YYYY-MM-DD
  dayLabel: string;                // 'T2' | 'T3' | 'T4' | 'T5' | 'T6' | 'T7' | 'CN'
  fullDateLabel: string;           // DD/MM
  expenseAmount: Money;            // Tổng chi tiêu trong ngày
  savingAmount: Money;             // Tổng tiết kiệm trong ngày
  incomeAmount: Money;             // Tổng thu nhập trong ngày
  totalOutflow: Money;             // expenseAmount + savingAmount
  isToday: boolean;
}

/**
 * 4. DTO cho Tình trạng Ngân sách từng danh mục (Category Budget Status)
 */
export type BudgetHealthStatus = 'SAFE' | 'WARNING' | 'OVER_LIMIT';

export interface CategoryBudgetStatusItem {
  categoryId: string;
  categoryName: string;
  icon: string;
  color: string;
  type: CategoryType;
  weeklyLimit: Money;
  spent: Money;
  remaining: Money;                // weeklyLimit - spent
  usagePercentage: number;         // % hạn mức đã dùng
  status: BudgetHealthStatus;      // SAFE (<75%), WARNING (75%-99%), OVER_LIMIT (>=100%)
  hasLimit: boolean;               // weeklyLimit > 0
}

/**
 * 5. DTO cho Bảng Thông báo & Thống kê Đầu tuần (Previous Week Recap)
 */
export interface PreviousWeekRecapMetrics {
  weekPeriod: WeekPeriod;
  weekLabel: string;               // VD: "12/10 - 18/10/2026"
  savedAmount: Money;              // Tổng số tiền đã Tiết kiệm được trong tuần trước
  remainingWeeklyBalance: Money;   // Tổng ngân sách tuần trước - Tổng đã chi tiêu tuần trước
  totalWeeklyAvailable: Money;     // Tổng ngân sách tuần trước
  totalWeeklyExpense: Money;       // Tổng đã chi tiêu trong tuần trước
  transactionCount: number;        // Số lượng giao dịch phát sinh tuần trước
  hasActivity: boolean;            // Tuần trước có phát sinh dữ liệu hay không
}

/**
 * Kết quả tổng hợp trả về cho Presentation Layer
 */
export interface WeeklyAnalyticsOutput {
  weekPeriod: WeekPeriod;
  weekLabel: string;
  isClosed: boolean;
  weeklySummary: WeeklySummaryMetrics;
  previousWeekRecap: PreviousWeekRecapMetrics;
  donutChartData: CategoryBreakdownItem[];
  barChartData: DailySpendingBarItem[];
  categoryBudgets: CategoryBudgetStatusItem[];
  recentTransactions: Transaction[];
}

const DAY_LABELS: readonly string[] = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

export class CalculateWeeklyAnalyticsUseCase {
  public constructor(
    private readonly weeklyCycleRepository: IWeeklyCycleRepository,
    private readonly transactionRepository: ITransactionRepository,
    private readonly categoryRepository: ICategoryRepository
  ) {}

  public async execute(referenceDate: Date = new Date()): Promise<WeeklyAnalyticsOutput> {
    const weekPeriod = WeekPeriod.fromDate(referenceDate);
    const previousPeriod = weekPeriod.getPreviousWeek();

    const [
      cycle,
      transactionsInRepo,
      categories,
      previousCycle,
      previousTransactionsInRepo,
    ] = await Promise.all([
      this.weeklyCycleRepository.findByWeekPeriod(weekPeriod),
      this.transactionRepository.findByWeekPeriod(weekPeriod),
      this.categoryRepository.findAll(true),
      this.weeklyCycleRepository.findByWeekPeriod(previousPeriod),
      this.transactionRepository.findByWeekPeriod(previousPeriod),
    ]);

    const transactions: ReadonlyArray<Transaction> =
      transactionsInRepo.length > 0
        ? [...transactionsInRepo].sort(
            (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
          )
        : cycle
          ? cycle.transactions
          : [];

    const openingBalance = cycle ? cycle.openingBalance : Money.zero();
    const weeklyAllowance = cycle ? cycle.weeklyAllowance : Money.zero();
    const isClosed = cycle ? cycle.isClosed : false;

    // 1. Tính tổng Thu / Chi / Tiết kiệm trong tuần đang xét
    let totalExpenseOnly = Money.zero();
    let totalSavingAllocated = Money.zero();
    let totalOtherIncome = Money.zero();

    for (const tx of transactions) {
      const txType = tx.getType();
      if (txType === 'EXPENSE') {
        totalExpenseOnly = totalExpenseOnly.add(tx.amount);
      } else if (txType === 'SAVING') {
        totalSavingAllocated = totalSavingAllocated.add(tx.amount);
      } else if (txType === 'INCOME') {
        totalOtherIncome = totalOtherIncome.add(tx.amount);
      }
    }

    const totalWeeklyAvailable = openingBalance
      .add(weeklyAllowance)
      .add(totalOtherIncome);

    const totalWeeklyExpense = totalExpenseOnly.add(totalSavingAllocated);
    const remainingWeeklyBalance = totalWeeklyAvailable.subtract(totalWeeklyExpense);

    const weeklyUsagePercentage =
      totalWeeklyAvailable.amount > 0
        ? Math.max(
            0,
            Math.round((totalWeeklyExpense.amount / totalWeeklyAvailable.amount) * 100)
          )
        : totalWeeklyExpense.amount > 0
          ? 100
          : 0;

    const weeklySummary: WeeklySummaryMetrics = {
      openingBalance,
      weeklyAllowance,
      totalOtherIncome,
      totalWeeklyAvailable,
      totalExpenseOnly,
      totalSavingAllocated,
      totalWeeklyExpense,
      remainingWeeklyBalance,
      weeklyUsagePercentage,
    };

    // 2. Tính toán Bảng Tổng kết Tuần trước (Previous Week Recap)
    const previousWeekRecap = this.computePreviousWeekRecap(
      previousPeriod,
      previousCycle,
      previousTransactionsInRepo,
      categories
    );

    // 3. Dữ liệu Biểu đồ Tròn (Donut Chart)
    const donutChartData = this.computeDonutChartData(transactions, categories);

    // 4. Dữ liệu Biểu đồ Cột (Bar Chart: T2 -> CN)
    const barChartData = this.computeBarChartData(weekPeriod, referenceDate, transactions);

    // 5. Tình trạng Ngân sách từng danh mục (Đọc từ categoryLimitsSnapshot của chính WeeklyCycle đó)
    const categoryBudgets = this.computeCategoryBudgets(
      transactions,
      categories,
      cycle
    );

    return {
      weekPeriod,
      weekLabel: weekPeriod.formatLabel(),
      isClosed,
      weeklySummary,
      previousWeekRecap,
      donutChartData,
      barChartData,
      categoryBudgets,
      recentTransactions: [...transactions],
    };
  }

  /**
   * Tính toán dữ liệu Tổng kết Tuần liền trước (Monday Weekly Recap)
   */
  private computePreviousWeekRecap(
    previousPeriod: WeekPeriod,
    previousCycle: WeeklyCycle | null,
    previousTransactionsInRepo: ReadonlyArray<Transaction>,
    categories: ReadonlyArray<Category>
  ): PreviousWeekRecapMetrics {
    const prevTransactions: ReadonlyArray<Transaction> =
      previousTransactionsInRepo.length > 0
        ? previousTransactionsInRepo
        : previousCycle
          ? previousCycle.transactions
          : [];

    const savingCategoryIds = new Set<string>(
      categories
        .filter(
          (c) =>
            c.type === 'SAVING' ||
            c.id === 'cat_saving' ||
            c.name.toLowerCase().includes('tiết kiệm')
        )
        .map((c) => c.id)
    );

    const prevOpening = previousCycle ? previousCycle.openingBalance : Money.zero();
    const prevAllowance = previousCycle ? previousCycle.weeklyAllowance : Money.zero();

    let prevExpenseOnly = Money.zero();
    let prevSaving = Money.zero();
    let prevOtherIncome = Money.zero();

    for (const tx of prevTransactions) {
      const txType = tx.getType();
      const isSavingTx =
        txType === 'SAVING' || savingCategoryIds.has(tx.categoryId);

      if (isSavingTx) {
        prevSaving = prevSaving.add(tx.amount);
      } else if (txType === 'EXPENSE') {
        prevExpenseOnly = prevExpenseOnly.add(tx.amount);
      } else if (txType === 'INCOME') {
        prevOtherIncome = prevOtherIncome.add(tx.amount);
      }
    }

    const totalWeeklyAvailable = prevOpening
      .add(prevAllowance)
      .add(prevOtherIncome);

    const totalWeeklyExpense = prevExpenseOnly.add(prevSaving);
    const remainingWeeklyBalance = totalWeeklyAvailable.subtract(totalWeeklyExpense);

    const hasActivity =
      prevTransactions.length > 0 ||
      totalWeeklyAvailable.isPositive() ||
      totalWeeklyExpense.isPositive();

    return {
      weekPeriod: previousPeriod,
      weekLabel: previousPeriod.formatLabel(),
      savedAmount: prevSaving,
      remainingWeeklyBalance,
      totalWeeklyAvailable,
      totalWeeklyExpense,
      transactionCount: prevTransactions.length,
      hasActivity,
    };
  }

  private computeDonutChartData(
    transactions: ReadonlyArray<Transaction>,
    categories: ReadonlyArray<Category>
  ): CategoryBreakdownItem[] {
    const categoryMap = new Map<string, Category>(categories.map((c) => [c.id, c]));
    const outflowTransactions = transactions.filter(
      (tx) => tx.getType() === 'EXPENSE' || tx.getType() === 'SAVING'
    );

    const totalOutflowAmount = outflowTransactions.reduce(
      (sum, tx) => sum + tx.amount.amount,
      0
    );

    if (totalOutflowAmount <= 0) {
      return [];
    }

    const grouped = new Map<string, { amount: number; count: number }>();

    for (const tx of outflowTransactions) {
      const current = grouped.get(tx.categoryId) ?? { amount: 0, count: 0 };
      current.amount += tx.amount.amount;
      current.count += 1;
      grouped.set(tx.categoryId, current);
    }

    const items: CategoryBreakdownItem[] = [];

    for (const [categoryId, stats] of grouped.entries()) {
      const category = categoryMap.get(categoryId);
      const percentage = Math.round((stats.amount / totalOutflowAmount) * 100);

      items.push({
        categoryId,
        categoryName: category ? category.name : 'Danh mục khác',
        icon: category ? category.icon : 'HelpCircle',
        color: category ? category.color : '#8B5CF6',
        type: category ? category.type : 'EXPENSE',
        amount: Money.fromAmount(stats.amount),
        percentage,
        transactionCount: stats.count,
      });
    }

    return items.sort((a, b) => b.amount.amount - a.amount.amount);
  }

  private computeBarChartData(
    weekPeriod: WeekPeriod,
    referenceDate: Date,
    transactions: ReadonlyArray<Transaction>
  ): DailySpendingBarItem[] {
    const monday = weekPeriod.startDate;
    const bars: DailySpendingBarItem[] = [];

    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const currentDay = new Date(
        monday.getFullYear(),
        monday.getMonth(),
        monday.getDate() + dayOffset,
        0,
        0,
        0,
        0
      );

      let expenseSum = 0;
      let savingSum = 0;
      let incomeSum = 0;

      for (const tx of transactions) {
        if (this.isSameCalendarDay(tx.timestamp, currentDay)) {
          const type = tx.getType();
          if (type === 'EXPENSE') {
            expenseSum += tx.amount.amount;
          } else if (type === 'SAVING') {
            savingSum += tx.amount.amount;
          } else if (type === 'INCOME') {
            incomeSum += tx.amount.amount;
          }
        }
      }

      const year = currentDay.getFullYear();
      const month = String(currentDay.getMonth() + 1).padStart(2, '0');
      const day = String(currentDay.getDate()).padStart(2, '0');

      bars.push({
        date: currentDay,
        dateKey: `${year}-${month}-${day}`,
        dayLabel: DAY_LABELS[dayOffset] ?? 'CN',
        fullDateLabel: `${day}/${month}`,
        expenseAmount: Money.fromAmount(expenseSum),
        savingAmount: Money.fromAmount(savingSum),
        incomeAmount: Money.fromAmount(incomeSum),
        totalOutflow: Money.fromAmount(expenseSum + savingSum),
        isToday: this.isSameCalendarDay(currentDay, referenceDate),
      });
    }

    return bars;
  }

  private computeCategoryBudgets(
    transactions: ReadonlyArray<Transaction>,
    categories: ReadonlyArray<Category>,
    cycle: WeeklyCycle | null
  ): CategoryBudgetStatusItem[] {
    const spentByCategory = new Map<string, number>();

    for (const tx of transactions) {
      const current = spentByCategory.get(tx.categoryId) ?? 0;
      spentByCategory.set(tx.categoryId, current + tx.amount.amount);
    }

    const activeCategories = categories.filter(
      (cat) => !cat.isArchived && (cat.type === 'EXPENSE' || cat.type === 'SAVING')
    );

    const statusList: CategoryBudgetStatusItem[] = activeCategories.map((cat) => {
      const spentAmount = spentByCategory.get(cat.id) ?? 0;

      const effectiveLimitMoney =
        cycle?.getCategoryLimitSnapshot(cat.id) ?? cat.weeklyLimit;
      const limitAmount = effectiveLimitMoney.amount;
      const hasLimit = limitAmount > 0;

      const remainingAmount = hasLimit ? limitAmount - spentAmount : 0;
      const usagePercentage = hasLimit
        ? Math.max(0, Math.round((spentAmount / limitAmount) * 100))
        : spentAmount > 0
          ? 100
          : 0;

      let status: BudgetHealthStatus = 'SAFE';
      if (hasLimit) {
        if (usagePercentage >= 100 || spentAmount > limitAmount) {
          status = 'OVER_LIMIT';
        } else if (usagePercentage >= 75) {
          status = 'WARNING';
        }
      }

      return {
        categoryId: cat.id,
        categoryName: cat.name,
        icon: cat.icon,
        color: cat.color,
        type: cat.type,
        weeklyLimit: effectiveLimitMoney,
        spent: Money.fromAmount(spentAmount),
        remaining: Money.fromAmount(remainingAmount),
        usagePercentage,
        status,
        hasLimit,
      };
    });

    return statusList.sort((a, b) => {
      if (a.hasLimit !== b.hasLimit) {
        return a.hasLimit ? -1 : 1;
      }
      return b.usagePercentage - a.usagePercentage || b.spent.amount - a.spent.amount;
    });
  }

  private isSameCalendarDay(dateA: Date, dateB: Date): boolean {
    return (
      dateA.getFullYear() === dateB.getFullYear() &&
      dateA.getMonth() === dateB.getMonth() &&
      dateA.getDate() === dateB.getDate()
    );
  }
}