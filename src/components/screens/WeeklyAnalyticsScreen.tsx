// src/components/screens/WeeklyAnalyticsScreen.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Flame,
  PieChart as PieChartIcon,
  TrendingUp,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useExpenseTracker } from '@/components/providers/ExpenseTrackerProvider';
import { CategoryIcon } from '@/components/ui/CategoryIcon';
import { SoftCard } from '@/components/ui/SoftCard';
import type { Category } from '@/core/domain/entities/Category';
import type { Transaction } from '@/core/domain/entities/Transaction';
import { Money } from '@/core/domain/value-objects/Money';
import { DIContainer } from '@/core/infrastructure/di/DIContainer';
import { cn } from '@/lib/utils';

type ReportPeriodScope = 'WEEKLY' | 'MONTHLY';
type FlowAnalysisTab = 'EXPENSE_FLOW' | 'INCOME_FLOW';

interface ChartCategorySlice {
  categoryId: string;
  categoryName: string;
  icon: string;
  color: string;
  amount: number;
  formattedAmount: string;
  exactPercentage: number; // VD: 33.8
  transactionCount: number;
}

interface BarDataPoint {
  label: string;
  subLabel: string;
  amount: number;
  formattedAmount: string;
  isPeak: boolean;
  isToday: boolean;
}

export const WeeklyAnalyticsScreen: React.FC = () => {
  const {
    selectedWeek,
    selectedDate,
    navigateWeek,
    analytics,
    allCategoriesIncludingArchived,
  } = useExpenseTracker();

  const [periodScope, setPeriodScope] = useState<ReportPeriodScope>('WEEKLY');
  const [flowTab, setFlowTab] = useState<FlowAnalysisTab>('EXPENSE_FLOW');
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [monthlyTransactions, setMonthlyTransactions] = useState<Transaction[]>([]);

  // Đảm bảo Recharts ResponsiveContainer chỉ render sau khi mount trên Client
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Tải giao dịch của cả tháng khi chuyển sang chế độ "Hàng Tháng"
  useEffect(() => {
    if (periodScope !== 'MONTHLY') return;

    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const monthStart = new Date(year, month, 1, 0, 0, 0, 0);
    const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);

    void (async () => {
      const repo = DIContainer.getInstance().transactionRepository;
      const list = await repo.findByDateRange(monthStart, monthEnd);
      setMonthlyTransactions(list);
    })();
  }, [periodScope, selectedDate, analytics]);

  const categoryMap = useMemo(() => {
    return new Map<string, Category>(
      allCategoriesIncludingArchived.map((c) => [c.id, c])
    );
  }, [allCategoriesIncludingArchived]);

  const activeTransactions = useMemo<ReadonlyArray<Transaction>>(() => {
    if (periodScope === 'MONTHLY') {
      return monthlyTransactions;
    }
    return analytics?.recentTransactions ?? [];
  }, [periodScope, monthlyTransactions, analytics]);

  // Tính toán dữ liệu cho Donut Chart và Danh sách Tỷ trọng Danh mục
  const categoryBreakdown = useMemo<{
    slices: ChartCategorySlice[];
    totalAmount: Money;
  }>(() => {
    const filtered = activeTransactions.filter((tx) => {
      const t = tx.getType();
      if (flowTab === 'INCOME_FLOW') {
        return t === 'INCOME';
      }
      return t === 'EXPENSE' || t === 'SAVING';
    });

    const totalRaw = filtered.reduce((sum, tx) => sum + tx.amount.amount, 0);
    if (totalRaw <= 0) {
      return { slices: [], totalAmount: Money.zero() };
    }

    const grouped = new Map<string, { amount: number; count: number }>();
    for (const tx of filtered) {
      const cur = grouped.get(tx.categoryId) ?? { amount: 0, count: 0 };
      cur.amount += tx.amount.amount;
      cur.count += 1;
      grouped.set(tx.categoryId, cur);
    }

    const slices: ChartCategorySlice[] = [];
    for (const [catId, stat] of grouped.entries()) {
      const cat = categoryMap.get(catId);
      const exactPct = Number(((stat.amount / totalRaw) * 100).toFixed(1));
      const moneyObj = Money.fromAmount(stat.amount);

      slices.push({
        categoryId: catId,
        categoryName: cat?.name ?? 'Danh mục khác',
        icon: cat?.icon ?? 'MoreHorizontal',
        color: cat?.color ?? '#8B5CF6',
        amount: stat.amount,
        formattedAmount: moneyObj.formatVND(),
        exactPercentage: exactPct,
        transactionCount: stat.count,
      });
    }

    slices.sort((a, b) => b.amount - a.amount);
    return {
      slices,
      totalAmount: Money.fromAmount(totalRaw),
    };
  }, [activeTransactions, flowTab, categoryMap]);

  // Tính toán dữ liệu cho Bar Chart (7 ngày từ T2 -> CN)
  const barChartItems = useMemo<BarDataPoint[]>(() => {
    const rawBars = analytics?.barChartData ?? [];
    if (rawBars.length === 0) return [];

    const values = rawBars.map((b) =>
      flowTab === 'INCOME_FLOW' ? b.incomeAmount.amount : b.totalOutflow.amount
    );
    const maxAmount = Math.max(...values, 0);

    return rawBars.map((b) => {
      const val =
        flowTab === 'INCOME_FLOW' ? b.incomeAmount.amount : b.totalOutflow.amount;
      return {
        label: b.dayLabel,
        subLabel: b.fullDateLabel,
        amount: val,
        formattedAmount: Money.fromAmount(val).formatVND(),
        isPeak: maxAmount > 0 && val === maxAmount,
        isToday: b.isToday,
      };
    });
  }, [analytics, flowTab]);

  const peakSpendingDay = useMemo(() => {
    return barChartItems.find((item) => item.isPeak && item.amount > 0) ?? null;
  }, [barChartItems]);

  const summary = analytics?.weeklySummary;
  const netWeeklyCashflow = summary
    ? summary.weeklyAllowance
        .add(summary.totalOtherIncome)
        .subtract(summary.totalWeeklyExpense)
    : Money.zero();

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* 1. HEADER & BỘ CHỌN KỲ: Segmented Control (Hàng Tuần | Hàng Tháng) & < Tuần DD/MM - DD/MM/YYYY > */}
      <SoftCard padding="sm" radius="2xl" className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
          {/* Segmented Control dáng Pill chuyển đổi giữa Hàng Tuần và Hàng Tháng */}
          <div
            role="tablist"
            aria-label="Kỳ báo cáo"
            className="inline-flex items-center rounded-full bg-slate-100 p-1 self-center sm:self-auto"
          >
            <button
              type="button"
              role="tab"
              aria-selected={periodScope === 'WEEKLY'}
              onClick={() => setPeriodScope('WEEKLY')}
              className={cn(
                'rounded-full px-4 py-1.5 text-xs sm:text-sm font-bold transition-all duration-200',
                periodScope === 'WEEKLY'
                  ? 'bg-[#8B5CF6] text-white shadow-soft-primary'
                  : 'text-ink-secondary hover:text-ink-primary'
              )}
            >
              Hàng Tuần
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={periodScope === 'MONTHLY'}
              onClick={() => setPeriodScope('MONTHLY')}
              className={cn(
                'rounded-full px-4 py-1.5 text-xs sm:text-sm font-bold transition-all duration-200',
                periodScope === 'MONTHLY'
                  ? 'bg-[#8B5CF6] text-white shadow-soft-primary'
                  : 'text-ink-secondary hover:text-ink-primary'
              )}
            >
              Hàng Tháng
            </button>
          </div>

          {/* Thanh chọn kỳ hạn < Tuần DD/MM - DD/MM/YYYY > */}
          <div className="flex items-center justify-between sm:justify-end gap-1.5 rounded-full bg-surface-muted px-2 py-1 border border-slate-200/70">
            <button
              type="button"
              onClick={() => navigateWeek('prev')}
              aria-label="Kỳ trước"
              className="flex h-7 w-7 items-center justify-center rounded-full text-ink-secondary hover:bg-white hover:text-primary active:scale-90 transition-all"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-2.5 text-xs sm:text-sm font-bold tabular-nums text-ink-primary">
              {periodScope === 'WEEKLY'
                ? `Tuần ${selectedWeek.formatLabel()}`
                : `Tháng ${String(selectedDate.getMonth() + 1).padStart(2, '0')}/${selectedDate.getFullYear()} (Tuần ${selectedWeek.formatLabel()})`}
            </span>
            <button
              type="button"
              onClick={() => navigateWeek('next')}
              aria-label="Kỳ kế tiếp"
              className="flex h-7 w-7 items-center justify-center rounded-full text-ink-secondary hover:bg-white hover:text-primary active:scale-90 transition-all"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </SoftCard>

      {/* 2. THẺ CHỈ SỐ TUẦN (WEEKLY METRICS CARDS) */}
      {summary && (
        <div className="space-y-2.5">
          {/* Hàng trên: Chi tiêu tuần (cam) | Chu cấp tuần (xanh) | Thu chi tuần */}
          <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
            <SoftCard padding="sm" radius="2xl" className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-ink-secondary">
                  Chi tiêu tuần
                </span>
                <ArrowDownRight className="h-3.5 w-3.5 text-semantic-warning" />
              </div>
              <p className="text-sm sm:text-base font-bold tabular-nums text-semantic-warning">
                {summary.totalWeeklyExpense.formatVND()}
              </p>
            </SoftCard>

            <SoftCard padding="sm" radius="2xl" className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-ink-secondary">
                  Chu cấp tuần
                </span>
                <ArrowUpRight className="h-3.5 w-3.5 text-semantic-safe" />
              </div>
              <p className="text-sm sm:text-base font-bold tabular-nums text-semantic-safe">
                {summary.weeklyAllowance.add(summary.totalOtherIncome).formatVND()}
              </p>
            </SoftCard>

            <SoftCard padding="sm" radius="2xl" className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-ink-secondary">
                  Thu chi tuần
                </span>
                <TrendingUp className="h-3.5 w-3.5 text-primary" />
              </div>
              <p
                className={cn(
                  'text-sm sm:text-base font-bold tabular-nums',
                  netWeeklyCashflow.isNegative()
                    ? 'text-semantic-danger'
                    : 'text-ink-primary'
                )}
              >
                {netWeeklyCashflow.isPositive() ? '+' : ''}
                {netWeeklyCashflow.formatVND()}
              </p>
            </SoftCard>
          </div>

          {/* Hàng dưới: Số dư đầu tuần | Số dư cuối tuần */}
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
            <SoftCard
              padding="sm"
              radius="2xl"
              className="flex items-center justify-between"
            >
              <span className="text-xs font-semibold text-ink-secondary">
                Số dư đầu tuần
              </span>
              <span className="text-xs sm:text-sm font-bold tabular-nums text-ink-primary">
                {summary.openingBalance.formatVND()}
              </span>
            </SoftCard>

            <SoftCard
              padding="sm"
              radius="2xl"
              className="flex items-center justify-between"
            >
              <span className="text-xs font-semibold text-ink-secondary">
                Số dư cuối tuần
              </span>
              <span
                className={cn(
                  'text-xs sm:text-sm font-bold tabular-nums',
                  summary.remainingWeeklyBalance.isNegative()
                    ? 'text-semantic-danger'
                    : 'text-semantic-safe'
                )}
              >
                {summary.remainingWeeklyBalance.formatVND()}
              </span>
            </SoftCard>
          </div>
        </div>
      )}

      {/* 3. BIỂU ĐỒ TRỰC QUAN (RECHARTS: DONUT CHART & BAR CHART) */}
      <SoftCard padding="md" radius="2xl" className="space-y-5">
        {/* Tab chuyển đổi phân tích Chi tiêu và Thu nhập */}
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3.5">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-ink-primary">
              Cơ cấu {flowTab === 'EXPENSE_FLOW' ? 'Chi tiêu' : 'Thu nhập'}{' '}
              {periodScope === 'WEEKLY' ? 'Tuần' : 'Tháng'}
            </h2>
            <p className="text-xs text-ink-secondary">
              Phân bổ tỷ trọng theo từng danh mục
            </p>
          </div>

          <div className="inline-flex rounded-full bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setFlowTab('EXPENSE_FLOW')}
              className={cn(
                'rounded-full px-3.5 py-1 text-xs font-bold transition-all',
                flowTab === 'EXPENSE_FLOW'
                  ? 'bg-surface text-semantic-warning shadow-sm'
                  : 'text-ink-secondary hover:text-ink-primary'
              )}
            >
              Chi tiêu
            </button>
            <button
              type="button"
              onClick={() => setFlowTab('INCOME_FLOW')}
              className={cn(
                'rounded-full px-3.5 py-1 text-xs font-bold transition-all',
                flowTab === 'INCOME_FLOW'
                  ? 'bg-surface text-semantic-safe shadow-sm'
                  : 'text-ink-secondary hover:text-ink-primary'
              )}
            >
              Thu nhập
            </button>
          </div>
        </div>

        {/* 3.1. DONUT CHART (Biểu đồ vành khuyên với tổng tiền ở tâm) */}
        {categoryBreakdown.slices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center space-y-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-ink-muted">
              <PieChartIcon className="h-6 w-6" />
            </div>
            <p className="text-sm font-bold text-ink-primary">
              Chưa có dữ liệu {flowTab === 'EXPENSE_FLOW' ? 'chi tiêu' : 'thu nhập'}
            </p>
            <p className="text-xs text-ink-secondary">
              Thêm giao dịch ở tab &ldquo;Nhập vào&rdquo; để xem biểu đồ phân tích trực quan.
            </p>
          </div>
        ) : (
          <div className="relative h-60 w-full">
            {isMounted && (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryBreakdown.slices}
                    dataKey="amount"
                    nameKey="categoryName"
                    cx="50%"
                    cy="50%"
                    innerRadius={68}
                    outerRadius={96}
                    paddingAngle={3}
                    cornerRadius={6}
                    stroke="none"
                  >
                    {categoryBreakdown.slices.map((slice) => (
                      <Cell key={slice.categoryId} fill={slice.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: unknown, name: unknown) => [
                      Money.fromAmount(Number(value) || 0).formatVND(),
                      String(name),
                    ]}
                    contentStyle={{
                      borderRadius: '16px',
                      border: '1px solid #F1F5F9',
                      boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
                      fontSize: '12px',
                      fontWeight: 600,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}

            {/* Tâm vòng tròn Donut: Hiển thị Tổng Chi tiêu / Thu nhập */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center px-4">
              <span className="text-[11px] font-semibold text-ink-secondary">
                {flowTab === 'EXPENSE_FLOW' ? 'Tổng chi' : 'Tổng thu'}
              </span>
              <span
                className={cn(
                  'mt-0.5 text-base sm:text-lg font-bold tabular-nums',
                  flowTab === 'EXPENSE_FLOW'
                    ? 'text-ink-primary'
                    : 'text-semantic-safe'
                )}
              >
                {categoryBreakdown.totalAmount.formatVND()}
              </span>
              <span className="text-[10px] font-medium text-ink-muted">
                {categoryBreakdown.slices.length} danh mục
              </span>
            </div>
          </div>
        )}
      </SoftCard>

      {/* 3.2. BAR CHART (Biểu đồ cột biến động qua 7 ngày T2 -> CN) */}
      <SoftCard padding="md" radius="2xl" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-ink-primary">
              Biến động theo ngày trong tuần (T2 - CN)
            </h3>
            <p className="text-xs text-ink-secondary">
              So sánh mức {flowTab === 'EXPENSE_FLOW' ? 'chi tiêu' : 'thu nhập'} giữa các ngày
            </p>
          </div>

          {peakSpendingDay && (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-semantic-warning-light/80 px-3 py-1 text-xs font-bold text-semantic-warning-dark">
              <Flame className="h-3.5 w-3.5 text-semantic-warning" />
              <span>
                Cao nhất: {peakSpendingDay.label} ({peakSpendingDay.formattedAmount})
              </span>
            </div>
          )}
        </div>

        <div className="h-52 w-full pt-2">
          {isMounted && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={barChartItems}
                margin={{ top: 8, right: 8, left: -18, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#E2E8F0"
                />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fontWeight: 700, fill: '#64748B' }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#94A3B8' }}
                  tickFormatter={(val: number) =>
                    val >= 1000 ? `${Math.round(val / 1000)}k` : String(val)
                  }
                />
                <Tooltip
                  cursor={{ fill: 'rgba(139, 92, 246, 0.06)' }}
                  formatter={(value: unknown) => [
                    Money.fromAmount(Number(value) || 0).formatVND(),
                    flowTab === 'EXPENSE_FLOW' ? 'Đã chi' : 'Đã thu',
                  ]}
                  labelFormatter={(label: unknown, payload: readonly { payload?: BarDataPoint }[]) => {
                    const item = payload?.[0]?.payload;
                    return item ? `${String(label)} (${item.subLabel})` : String(label);
                  }}
                  contentStyle={{
                    borderRadius: '14px',
                    border: '1px solid #F1F5F9',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
                    fontSize: '12px',
                    fontWeight: 600,
                  }}
                />
                <Bar dataKey="amount" radius={[8, 8, 4, 4]} maxBarSize={36}>
                  {barChartItems.map((entry, idx) => (
                    <Cell
                      key={`bar-${idx}`}
                      fill={
                        entry.isPeak
                          ? '#F97316'
                          : entry.isToday
                            ? '#8B5CF6'
                            : '#C4B5FD'
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </SoftCard>

      {/* 4. DANH SÁCH TỶ TRỌNG DANH MỤC (Sắp xếp từ cao xuống thấp kèm số tiền & %) */}
      <SoftCard padding="md" radius="2xl" className="space-y-3.5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm sm:text-base font-bold text-ink-primary">
            Tỷ trọng theo Danh mục
          </h3>
          <span className="text-xs font-bold text-ink-secondary">
            Tổng: {categoryBreakdown.totalAmount.formatVND()}
          </span>
        </div>

        {categoryBreakdown.slices.length === 0 ? (
          <p className="py-6 text-center text-xs text-ink-secondary">
            Chưa có giao dịch phát sinh trong kỳ đang chọn.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {categoryBreakdown.slices.map((item) => (
              <div
                key={item.categoryId}
                className="flex items-center justify-between gap-3 py-3 first:pt-1 last:pb-1"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl shadow-sm"
                    style={{
                      backgroundColor: `${item.color}18`,
                      color: item.color,
                    }}
                  >
                    <CategoryIcon iconName={item.icon} className="h-5 w-5" />
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-ink-primary">
                      {item.categoryName}
                    </p>
                    <p className="text-xs text-ink-secondary">
                      {item.transactionCount} giao dịch
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 text-right">
                  <div>
                    <p className="text-sm sm:text-base font-bold tabular-nums text-ink-primary">
                      {item.formattedAmount}
                    </p>
                    <p
                      className="text-xs font-bold tabular-nums"
                      style={{ color: item.color }}
                    >
                      {item.exactPercentage.toFixed(1)}%
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SoftCard>
    </div>
  );
};