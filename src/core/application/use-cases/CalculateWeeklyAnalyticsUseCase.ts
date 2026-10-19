import type { Category, CategoryType } from '../../domain/entities/Category';
import type { Transaction } from '../../domain/entities/Transaction';
import type { ICategoryRepository } from '../../domain/repositories/ICategoryRepository';
import type { ITransactionRepository } from '../../domain/repositories/ITransactionRepository';
import type { IWeeklyCycleRepository } from '../../domain/repositories/IWeeklyCycleRepository';
import { Money } from '../../domain/value-objects/Money';
import { WeekPeriod } from '../../domain/value-objects/WeekPeriod';

/**
 * 1. DTO cho Widget "Được tiêu hôm nay" (DailySafeToSpendAllowance)
 */
export interface DailySafeToSpendMetrics {
  remainingDays: number;           // 1 -> 7 ngày
  todaySpent: Money;               // Tổng tiền chi tiêu trong ngày hôm nay
  startOfDayRemaining: Money;      // RemainingWeeklyBalance + TodaySpent
  dailyAllowance: Money;           // Math.max(0, Math.floor(StartOfDayRemaining / RemainingDays))
  todayRemaining: Money;           // DailyAllowance - TodaySpent
  todayUsagePercentage: number;    // 0 -> 100%
  isOverspentToday: boolean;       // TodayRemaining < 0
}

/**
 * 2. DTO cho Tóm tắt Tuần (Weekly Summary)
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
 * 3. DTO cho Biểu đồ Tròn (Donut Chart)
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
 * 4. DTO cho Biểu đồ Cột (Bar Chart: Thứ 2 -> Chủ Nhật)
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
 * 5. DTO cho Tình trạng Ngân sách từng danh mục (Category Budget Status)
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
 * Kết quả tổng hợp trả về cho Presentation Layer
 */
export interface WeeklyAnalyticsOutput {
  weekPeriod: WeekPeriod;
  weekLabel: string;
  isClosed: boolean;
  dailySafeToSpend: DailySafeToSpendMetrics;
  weeklySummary: WeeklySummaryMetrics;
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

    const [cycle, transactionsInRepo, categories] = await Promise.all([
      this.weeklyCycleRepository.findByWeekPeriod(weekPeriod),
      this.transactionRepository.findByWeekPeriod(weekPeriod),
      this.categoryRepository.findAll(true),
    ]);

    // Ưu tiên danh sách giao dịch từ repository hoặc từ cycle
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

    // 1. Tính tổng Thu / Chi / Tiết kiệm trong tuần
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

    // Công thức 1: TotalWeeklyAvailable = OpeningBalance + WeeklyAllowance + TotalOtherIncome
    const totalWeeklyAvailable = openingBalance
      .add(weeklyAllowance)
      .add(totalOtherIncome);

    // Tổng chi trong tuần (bao gồm cả khoản đưa vào Tiết kiệm tính là chi phân bổ)
    const totalWeeklyExpense = totalExpenseOnly.add(totalSavingAllocated);

    // Công thức 2: RemainingWeeklyBalance = TotalWeeklyAvailable - TotalWeeklyExpense
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

    // 2. Công thức 3: Tính Widget "Được tiêu hôm nay" (DailySafeToSpendAllowance)
    const dailySafeToSpend = this.computeDailySafeToSpend(
      weekPeriod,
      referenceDate,
      remainingWeeklyBalance,
      transactions
    );

    // 3. Dữ liệu Biểu đồ Tròn (Donut Chart)
    const donutChartData = this.computeDonutChartData(transactions, categories);

    // 4. Dữ liệu Biểu đồ Cột (Bar Chart: T2 -> CN)
    const barChartData = this.computeBarChartData(weekPeriod, referenceDate, transactions);

    // 5. Tình trạng Ngân sách từng danh mục (Category Budget Status)
    const categoryBudgets = this.computeCategoryBudgets(transactions, categories);

    return {
      weekPeriod,
      weekLabel: weekPeriod.formatLabel(),
      isClosed,
      dailySafeToSpend,
      weeklySummary,
      donutChartData,
      barChartData,
      categoryBudgets,
      recentTransactions: [...transactions],
    };
  }

  /**
   * Cài đặt chính xác công thức "Được tiêu hôm nay" (DailySafeToSpendAllowance)
   */
  private computeDailySafeToSpend(
    weekPeriod: WeekPeriod,
    referenceDate: Date,
    remainingWeeklyBalance: Money,
    transactions: ReadonlyArray<Transaction>
  ): DailySafeToSpendMetrics {
    // RemainingDays: từ 1 đến 7 ngày
    const remainingDays = weekPeriod.getRemainingDaysFrom(referenceDate);

    // TodaySpent: Tổng tiền chi tiêu trong ngày đang xét
    let todaySpentAmount = 0;
    for (const tx of transactions) {
      if (
        (tx.getType() === 'EXPENSE' || tx.getType() === 'SAVING') &&
        this.isSameCalendarDay(tx.timestamp, referenceDate)
      ) {
        todaySpentAmount += tx.amount.amount;
      }
    }

    const todaySpent = Money.fromAmount(todaySpentAmount);

    // StartOfDayRemaining = RemainingWeeklyBalance + TodaySpent
    const startOfDayRemainingAmount = remainingWeeklyBalance.amount + todaySpent.amount;
    const startOfDayRemaining = Money.fromAmount(startOfDayRemainingAmount);

    // DailyAllowance = Math.max(0, Math.floor(StartOfDayRemaining / RemainingDays))
    const dailyAllowanceAmount = Math.max(
      0,
      Math.floor(startOfDayRemainingAmount / remainingDays)
    );
    const dailyAllowance = Money.fromAmount(dailyAllowanceAmount);

    // TodayRemaining = DailyAllowance - TodaySpent
    const todayRemainingAmount = dailyAllowanceAmount - todaySpent.amount;
    const todayRemaining = Money.fromAmount(todayRemainingAmount);

    // TodayUsagePercentage = DailyAllowance > 0 ? Math.min(100, Math.round((TodaySpent / DailyAllowance) * 100)) : (TodaySpent > 0 ? 100 : 0)
    const todayUsagePercentage =
      dailyAllowanceAmount > 0
        ? Math.min(100, Math.round((todaySpent.amount / dailyAllowanceAmount) * 100))
        : todaySpent.amount > 0
          ? 100
          : 0;

    return {
      remainingDays,
      todaySpent,
      startOfDayRemaining,
      dailyAllowance,
      todayRemaining,
      todayUsagePercentage,
      isOverspentToday: todayRemainingAmount < 0,
    };
  }

  /**
   * Tính tỷ trọng % và tổng tiền theo từng danh mục cho Biểu đồ Tròn (Donut Chart)
   */
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

  /**
   * Tính tổng chi tiêu của từng ngày từ Thứ 2 đến Chủ Nhật cho Biểu đồ Cột (Bar Chart)
   */
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

  /**
   * Tính tình trạng Ngân sách từng danh mục (weeklyLimit, spent, remaining, usagePercentage)
   */
  private computeCategoryBudgets(
    transactions: ReadonlyArray<Transaction>,
    categories: ReadonlyArray<Category>
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
      const limitAmount = cat.weeklyLimit.amount;
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
        weeklyLimit: cat.weeklyLimit,
        spent: Money.fromAmount(spentAmount),
        remaining: Money.fromAmount(remainingAmount),
        usagePercentage,
        status,
        hasLimit,
      };
    });

    // Sắp xếp ưu tiên các danh mục có tỷ lệ sử dụng ngân sách cao nhất lên đầu
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