// src/components/screens/CalendarLogScreen.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Calendar as CalendarIcon,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Clock,
  History,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useExpenseTracker } from '@/components/providers/ExpenseTrackerProvider';
import { CategoryIcon } from '@/components/ui/CategoryIcon';
import { PillButton } from '@/components/ui/PillButton';
import { SoftCard } from '@/components/ui/SoftCard';
import type { Category } from '@/core/domain/entities/Category';
import type { Transaction } from '@/core/domain/entities/Transaction';
import { DIContainer } from '@/core/infrastructure/di/DIContainer';
import { cn } from '@/lib/utils';

type CalendarViewMode = 'WEEK' | 'MONTH';

interface CalendarCellData {
  date: Date;
  dateKey: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isSelectedWeek: boolean;
  isToday: boolean;
  isSelectedDate: boolean;
  spentAmount: number;
  incomeAmount: number;
}

interface DayTransactionGroup {
  date: Date;
  dateKey: string;
  headerLabel: string; // DD/MM/YYYY (Th X)
  totalOutflow: number;
  totalInflow: number;
  netAmount: number;
  transactions: Transaction[];
}

const WEEKDAY_HEADERS: readonly { label: string; isSaturday?: boolean; isSunday?: boolean }[] = [
  { label: 'T2' },
  { label: 'T3' },
  { label: 'T4' },
  { label: 'T5' },
  { label: 'T6' },
  { label: 'T7', isSaturday: true },
  { label: 'CN', isSunday: true },
];

function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDayHeaderLabel(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  const dow = date.getDay();
  const thLabel = dow === 0 ? 'CN' : `Th ${dow + 1}`;
  return `${d}/${m}/${y} (${thLabel})`;
}

function formatCompactNumber(amount: number): string {
  return Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function formatTimeHHMM(date: Date): string {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export const CalendarLogScreen: React.FC = () => {
  const {
    selectedWeek,
    selectedDate,
    setSelectedDate,
    navigateWeek,
    analytics,
    categories,
    allCategoriesIncludingArchived,
    auditLogs,
    updateTransaction,
    deleteTransaction,
  } = useExpenseTracker();

  // 1. Trạng thái chế độ xem (Lịch Tuần / Lịch Tháng), tìm kiếm & lọc ngày
  const [viewMode, setViewMode] = useState<CalendarViewMode>('WEEK');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [focusedDateKey, setFocusedDateKey] = useState<string | null>(null);

  // 2. Dữ liệu giao dịch cả tháng (phục vụ khi bật chế độ Lịch Tháng)
  const [monthTransactions, setMonthTransactions] = useState<Transaction[]>([]);

  // 3. Trạng thái Modal Chỉnh sửa Giao dịch & Modal Audit Log
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState<boolean>(false);

  // Map tra cứu nhanh Category theo ID (bao gồm cả danh mục đã archive để không lỗi lịch sử)
  const categoryMap = useMemo(() => {
    return new Map<string, Category>(
      allCategoriesIncludingArchived.map((cat) => [cat.id, cat])
    );
  }, [allCategoriesIncludingArchived]);

  // Nạp giao dịch của toàn bộ tháng đang xem khi ở chế độ MONTH
  useEffect(() => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();

    // Lấy từ đầu tuần của ngày mùng 1 đến cuối tuần của ngày cuối tháng
    const firstDayOfMonth = new Date(year, month, 1, 0, 0, 0, 0);
    const lastDayOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999);

    const startGrid = new Date(firstDayOfMonth.getTime() - 7 * 86_400_000);
    const endGrid = new Date(lastDayOfMonth.getTime() + 7 * 86_400_000);

    void (async () => {
      const repo = DIContainer.getInstance().transactionRepository;
      const list = await repo.findByDateRange(startGrid, endGrid);
      setMonthTransactions(list);
    })();
  }, [selectedDate, analytics]);

  // Reset bộ lọc ngày đơn lẻ khi đổi tuần
  useEffect(() => {
    setFocusedDateKey(null);
  }, [selectedWeek]);

  // Tính tổng chi/thu theo từng dateKey (YYYY-MM-DD)
  const dailyTotalsMap = useMemo(() => {
    const map = new Map<string, { spent: number; income: number }>();
    const sourceList =
      viewMode === 'MONTH' && monthTransactions.length > 0
        ? monthTransactions
        : (analytics?.recentTransactions ?? []);

    for (const tx of sourceList) {
      const key = toDateKey(tx.timestamp);
      const current = map.get(key) ?? { spent: 0, income: 0 };
      const type = tx.getType();
      if (type === 'EXPENSE' || type === 'SAVING') {
        current.spent += tx.amount.amount;
      } else if (type === 'INCOME') {
        current.income += tx.amount.amount;
      }
      map.set(key, current);
    }
    return map;
  }, [viewMode, monthTransactions, analytics]);

  // Xây dựng danh sách các ô lịch (7 ô cho Lịch Tuần, 35-42 ô cho Lịch Tháng)
  const calendarCells = useMemo<CalendarCellData[]>(() => {
    const todayKey = toDateKey(new Date());
    const selectedKey = toDateKey(selectedDate);

    if (viewMode === 'WEEK') {
      const monday = selectedWeek.startDate;
      const cells: CalendarCellData[] = [];

      for (let i = 0; i < 7; i++) {
        const d = new Date(
          monday.getFullYear(),
          monday.getMonth(),
          monday.getDate() + i,
          12,
          0,
          0,
          0
        );
        const key = toDateKey(d);
        const totals = dailyTotalsMap.get(key) ?? { spent: 0, income: 0 };

        cells.push({
          date: d,
          dateKey: key,
          dayNumber: d.getDate(),
          isCurrentMonth: true,
          isSelectedWeek: true,
          isToday: key === todayKey,
          isSelectedDate: key === selectedKey,
          spentAmount: totals.spent,
          incomeAmount: totals.income,
        });
      }
      return cells;
    }

    // Chế độ Lịch Tháng (chuẩn Thứ Hai -> Chủ Nhật)
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const firstDay = new Date(year, month, 1, 12, 0, 0, 0);
    const dow = firstDay.getDay();
    const offsetToMonday = dow === 0 ? -6 : 1 - dow;

    const startGridDate = new Date(year, month, 1 + offsetToMonday, 12, 0, 0, 0);
    const lastDay = new Date(year, month + 1, 0, 12, 0, 0, 0);
    const lastDow = lastDay.getDay();
    const offsetToSunday = lastDow === 0 ? 0 : 7 - lastDow;
    const endGridDate = new Date(
      year,
      month + 1,
      offsetToSunday,
      12,
      0,
      0,
      0
    );

    const totalDays =
      Math.round(
        (endGridDate.getTime() - startGridDate.getTime()) / (24 * 60 * 60 * 1000)
      ) + 1;

    const cells: CalendarCellData[] = [];
    for (let i = 0; i < totalDays; i++) {
      const d = new Date(
        startGridDate.getFullYear(),
        startGridDate.getMonth(),
        startGridDate.getDate() + i,
        12,
        0,
        0,
        0
      );
      const key = toDateKey(d);
      const totals = dailyTotalsMap.get(key) ?? { spent: 0, income: 0 };

      cells.push({
        date: d,
        dateKey: key,
        dayNumber: d.getDate(),
        isCurrentMonth: d.getMonth() === month,
        isSelectedWeek: selectedWeek.contains(d),
        isToday: key === todayKey,
        isSelectedDate: key === selectedKey,
        spentAmount: totals.spent,
        incomeAmount: totals.income,
      });
    }

    return cells;
  }, [viewMode, selectedWeek, selectedDate, dailyTotalsMap]);

  // Lọc và phân nhóm giao dịch theo từng ngày (Timeline List)
  const timelineGroups = useMemo<DayTransactionGroup[]>(() => {
    const rawTransactions = analytics?.recentTransactions ?? [];
    const normalizedQuery = searchQuery.trim().toLowerCase();

    const filtered = rawTransactions.filter((tx) => {
      const txDateKey = toDateKey(tx.timestamp);
      if (focusedDateKey && txDateKey !== focusedDateKey) {
        return false;
      }

      if (!normalizedQuery) return true;

      const cat = categoryMap.get(tx.categoryId);
      const catName = (cat?.name ?? '').toLowerCase();
      const noteText = tx.note.toLowerCase();
      const amountStr = String(tx.amount.amount);

      return (
        catName.includes(normalizedQuery) ||
        noteText.includes(normalizedQuery) ||
        amountStr.includes(normalizedQuery)
      );
    });

    const groupMap = new Map<string, DayTransactionGroup>();

    for (const tx of filtered) {
      const key = toDateKey(tx.timestamp);
      let group = groupMap.get(key);

      if (!group) {
        group = {
          date: new Date(
            tx.timestamp.getFullYear(),
            tx.timestamp.getMonth(),
            tx.timestamp.getDate(),
            12,
            0,
            0,
            0
          ),
          dateKey: key,
          headerLabel: formatDayHeaderLabel(tx.timestamp),
          totalOutflow: 0,
          totalInflow: 0,
          netAmount: 0,
          transactions: [],
        };
        groupMap.set(key, group);
      }

      group.transactions.push(tx);
      const type = tx.getType();
      if (type === 'EXPENSE' || type === 'SAVING') {
        group.totalOutflow += tx.amount.amount;
        group.netAmount -= tx.amount.amount;
      } else {
        group.totalInflow += tx.amount.amount;
        group.netAmount += tx.amount.amount;
      }
    }

    return Array.from(groupMap.values()).sort(
      (a, b) => b.date.getTime() - a.date.getTime()
    );
  }, [analytics, searchQuery, focusedDateKey, categoryMap]);

  // Xử lý khi bấm vào một ô ngày trên Lưới Lịch
  const handleSelectCalendarCell = (cell: CalendarCellData) => {
    setSelectedDate(cell.date);

    // Bật/tắt lọc nhanh theo ngày hoặc cuộn mượt tới nhóm nhật ký của ngày đó
    if (focusedDateKey === cell.dateKey) {
      setFocusedDateKey(null);
    } else {
      const targetElement = document.getElementById(`timeline-day-${cell.dateKey}`);
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  const weeklySummary = analytics?.weeklySummary;

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* 1. THANH CHỌN KỲ HẠN & CHẾ ĐỘ XEM + TÌM KIẾM NHANH */}
      <SoftCard padding="sm" radius="2xl" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Bộ chọn tuần: < Tuần DD/MM - DD/MM/YYYY > */}
          <div className="flex items-center gap-1 rounded-full bg-surface-muted px-2 py-1 border border-slate-200/70">
            <button
              type="button"
              onClick={() => navigateWeek('prev')}
              aria-label="Tuần trước"
              className="flex h-7 w-7 items-center justify-center rounded-full text-ink-secondary hover:bg-white hover:text-primary active:scale-90 transition-all"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-2 text-xs sm:text-sm font-bold tabular-nums text-ink-primary">
              Tuần {selectedWeek.formatLabel()}
            </span>
            <button
              type="button"
              onClick={() => navigateWeek('next')}
              aria-label="Tuần sau"
              className="flex h-7 w-7 items-center justify-center rounded-full text-ink-secondary hover:bg-white hover:text-primary active:scale-90 transition-all"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Chuyển đổi nhanh giữa Lịch Tuần (7 ngày) & Lịch Tháng */}
          <div className="inline-flex items-center rounded-full bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setViewMode('WEEK')}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-all',
                viewMode === 'WEEK'
                  ? 'bg-[#8B5CF6] text-white shadow-sm'
                  : 'text-ink-secondary hover:text-ink-primary'
              )}
            >
              <CalendarRange className="h-3.5 w-3.5" />
              <span>Lịch Tuần</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('MONTH')}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-all',
                viewMode === 'MONTH'
                  ? 'bg-[#8B5CF6] text-white shadow-sm'
                  : 'text-ink-secondary hover:text-ink-primary'
              )}
            >
              <CalendarIcon className="h-3.5 w-3.5" />
              <span>Lịch Tháng</span>
            </button>
          </div>
        </div>

        {/* Thanh tìm kiếm nhanh theo ghi chú / danh mục */}
        <div className="relative flex items-center">
          <Search className="pointer-events-none absolute left-3.5 h-4 w-4 text-ink-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo ghi chú, tên danh mục hoặc số tiền..."
            className="w-full rounded-full bg-surface-muted pl-9 pr-9 py-2 text-xs sm:text-sm font-medium text-ink-primary placeholder:text-ink-muted border border-slate-200/60 focus:border-primary focus:bg-white focus:outline-none transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Xóa từ khóa"
              className="absolute right-3 flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-ink-secondary hover:text-ink-primary"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </SoftCard>

      {/* 2. LƯỚI LỊCH (CALENDAR GRID: T2 -> CN) */}
      <SoftCard padding="sm" radius="2xl" className="space-y-2.5">
        {viewMode === 'MONTH' && (
          <div className="flex items-center justify-between px-1 pb-1">
            <span className="text-xs font-bold text-ink-secondary">
              Tháng {selectedDate.getMonth() + 1}/{selectedDate.getFullYear()}
            </span>
            <span className="text-[11px] font-medium text-primary">
              Khung viền tím là tuần đang chọn ({selectedWeek.formatLabel()})
            </span>
          </div>
        )}

        {/* Header 7 cột từ T2 đến CN (T7 màu xanh dương, CN màu đỏ) */}
        <div className="grid grid-cols-7 gap-1 text-center">
          {WEEKDAY_HEADERS.map((dayHeader) => (
            <div
              key={dayHeader.label}
              className={cn(
                'py-1.5 text-xs font-bold tracking-wide',
                dayHeader.isSaturday && 'text-blue-600',
                dayHeader.isSunday && 'text-semantic-danger',
                !dayHeader.isSaturday && !dayHeader.isSunday && 'text-ink-secondary'
              )}
            >
              {dayHeader.label}
            </div>
          ))}
        </div>

        {/* Các ô ngày trong Lưới Lịch */}
        <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
          {calendarCells.map((cell) => {
            const dow = cell.date.getDay();
            const isSat = dow === 6;
            const isSun = dow === 0;
            const isFocused = focusedDateKey === cell.dateKey;

            return (
              <button
                key={cell.dateKey}
                type="button"
                onClick={() => handleSelectCalendarCell(cell)}
                className={cn(
                  'relative flex min-h-[62px] sm:min-h-[70px] flex-col items-center justify-between rounded-xl p-1.5 text-center select-none',
                  'transition-all duration-200 ease-apple-spring active:scale-95',
                  !cell.isCurrentMonth && 'opacity-35',
                  cell.isSelectedWeek && viewMode === 'MONTH' && 'bg-primary-50/40',
                  cell.isSelectedDate || isFocused
                    ? 'bg-primary-50 border-2 border-[#8B5CF6] shadow-sm'
                    : 'bg-surface-muted/70 border border-slate-100 hover:border-slate-200 hover:bg-white'
                )}
              >
                {/* Góc trên: Số ngày */}
                <div className="flex w-full items-center justify-between px-0.5">
                  <span
                    className={cn(
                      'inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold tabular-nums',
                      cell.isToday
                        ? 'bg-[#8B5CF6] text-white shadow-sm'
                        : isSun
                          ? 'text-semantic-danger'
                          : isSat
                            ? 'text-blue-600'
                            : 'text-ink-primary'
                    )}
                  >
                    {cell.dayNumber}
                  </span>

                  {cell.incomeAmount > 0 && (
                    <span
                      className="h-1.5 w-1.5 rounded-full bg-semantic-safe"
                      title={`Thu: +${formatCompactNumber(cell.incomeAmount)}đ`}
                    />
                  )}
                </div>

                {/* Ngay bên dưới: Tổng số tiền đã chi của ngày hôm đó (chữ nhỏ màu cam/đỏ) */}
                <div className="w-full pt-1">
                  {cell.spentAmount > 0 ? (
                    <span
                      className={cn(
                        'block w-full truncate text-[10px] sm:text-[11px] font-bold tabular-nums tracking-tighter leading-tight',
                        cell.spentAmount >= 150_000
                          ? 'text-semantic-danger'
                          : 'text-semantic-warning'
                      )}
                    >
                      {formatCompactNumber(cell.spentAmount)}
                    </span>
                  ) : (
                    <span className="block text-[10px] font-medium text-slate-300">
                      -
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Nút lọc theo ngày đang chọn (nếu người dùng muốn chỉ xem 1 ngày hoặc xem cả tuần) */}
        <div className="flex items-center justify-between pt-1 px-1 text-xs">
          <span className="text-ink-secondary">
            Đang chọn:{' '}
            <strong className="font-bold text-ink-primary">
              {formatDayHeaderLabel(selectedDate)}
            </strong>
          </span>

          {focusedDateKey ? (
            <button
              type="button"
              onClick={() => setFocusedDateKey(null)}
              className="font-bold text-primary hover:underline"
            >
              Xem toàn bộ tuần ({selectedWeek.formatLabel()})
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setFocusedDateKey(toDateKey(selectedDate))}
              className="font-semibold text-ink-secondary hover:text-primary"
            >
              Chỉ lọc ngày này
            </button>
          )}
        </div>
      </SoftCard>

      {/* 3. THANH TÓM TẮT TUẦN (WEEKLY SUMMARY STRIP) */}
      {weeklySummary && (
        <SoftCard padding="none" radius="2xl" className="overflow-hidden border border-slate-100">
          {/* Hàng trên (3 cột): Chu cấp tuần | Chi tiêu tuần | Tổng còn lại */}
          <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100 bg-surface">
            <div className="p-3 sm:p-4 text-center">
              <p className="text-[11px] sm:text-xs font-semibold text-ink-secondary">
                Chu cấp tuần
              </p>
              <p className="mt-1 text-xs sm:text-base font-bold tabular-nums text-semantic-safe">
                {weeklySummary.weeklyAllowance.formatVND()}
              </p>
              {weeklySummary.totalOtherIncome.isPositive() && (
                <p className="text-[10px] font-semibold text-emerald-600">
                  +{weeklySummary.totalOtherIncome.formatVND()} thu khác
                </p>
              )}
            </div>

            <div className="p-3 sm:p-4 text-center">
              <p className="text-[11px] sm:text-xs font-semibold text-ink-secondary">
                Chi tiêu tuần
              </p>
              <p className="mt-1 text-xs sm:text-base font-bold tabular-nums text-semantic-warning">
                {weeklySummary.totalWeeklyExpense.formatVND()}
              </p>
            </div>

            <div className="p-3 sm:p-4 text-center">
              <p className="text-[11px] sm:text-xs font-semibold text-ink-secondary">
                Tổng còn lại
              </p>
              <p
                className={cn(
                  'mt-1 text-xs sm:text-base font-bold tabular-nums',
                  weeklySummary.remainingWeeklyBalance.isNegative()
                    ? 'text-semantic-danger'
                    : 'text-semantic-safe'
                )}
              >
                {weeklySummary.remainingWeeklyBalance.formatVND()}
              </p>
            </div>
          </div>

          {/* Hàng dưới (2 cột): Số dư đầu tuần | Số dư hiện tại */}
          <div className="grid grid-cols-2 divide-x divide-slate-100 bg-surface-muted/70">
            <div className="flex items-center justify-between px-3.5 sm:px-5 py-2.5">
              <span className="text-xs font-medium text-ink-secondary">
                Số dư đầu tuần
              </span>
              <span className="text-xs sm:text-sm font-bold tabular-nums text-ink-primary">
                {weeklySummary.openingBalance.formatVND()}
              </span>
            </div>

            <div className="flex items-center justify-between px-3.5 sm:px-5 py-2.5">
              <span className="text-xs font-medium text-ink-secondary">
                Số dư hiện tại
              </span>
              <span
                className={cn(
                  'text-xs sm:text-sm font-bold tabular-nums',
                  weeklySummary.remainingWeeklyBalance.isNegative()
                    ? 'text-semantic-danger'
                    : 'text-primary'
                )}
              >
                {weeklySummary.remainingWeeklyBalance.formatVND()}
              </span>
            </div>
          </div>
        </SoftCard>
      )}

      {/* 4. DANH SÁCH LỊCH SỬ GIAO DỊCH (TIMELINE LIST) & NÚT AUDIT LOG */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-ink-secondary">
            Nhật ký giao dịch ({timelineGroups.reduce((acc, g) => acc + g.transactions.length, 0)})
          </h3>

          {/* Nút mở Nhật ký hệ thống (Audit Log) */}
          <button
            type="button"
            onClick={() => setIsAuditModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-xs font-bold text-primary shadow-soft border border-slate-100 hover:bg-primary-50 transition-colors"
          >
            <History className="h-3.5 w-3.5" />
            <span>Nhật ký hệ thống ({auditLogs.length})</span>
          </button>
        </div>

        {timelineGroups.length === 0 ? (
          <SoftCard padding="lg" radius="2xl" className="text-center space-y-2 py-10">
            <p className="text-sm font-bold text-ink-primary">
              Chưa có giao dịch nào được ghi nhận
            </p>
            <p className="text-xs text-ink-secondary">
              {searchQuery || focusedDateKey
                ? 'Không tìm thấy giao dịch khớp với bộ lọc hiện tại.'
                : 'Hãy chuyển sang tab "Nhập vào" để thêm khoản thu/chi đầu tiên cho tuần này.'}
            </p>
          </SoftCard>
        ) : (
          <div className="space-y-3.5">
            {timelineGroups.map((group) => {
              const isNetNegative = group.netAmount <= 0;
              const formattedDayNet = `${isNetNegative ? '-' : '+'}${formatCompactNumber(
                Math.abs(group.netAmount)
              )}đ`;

              return (
                <SoftCard
                  key={group.dateKey}
                  id={`timeline-day-${group.dateKey}`}
                  padding="none"
                  radius="2xl"
                  className="overflow-hidden border border-slate-100"
                >
                  {/* Thanh tiêu đề mỗi ngày: DD/MM/YYYY (Th X) bên trái | Tổng thu/chi ngày đó bên phải */}
                  <div className="flex items-center justify-between bg-surface-muted px-4 py-2.5 border-b border-slate-100">
                    <span className="text-xs sm:text-sm font-bold text-ink-primary">
                      {group.headerLabel}
                    </span>
                    <span
                      className={cn(
                        'text-xs sm:text-sm font-bold tabular-nums',
                        isNetNegative ? 'text-semantic-warning' : 'text-semantic-safe'
                      )}
                    >
                      {formattedDayNet}
                    </span>
                  </div>

                  {/* Danh sách từng giao dịch trong ngày */}
                  <div className="divide-y divide-slate-100 bg-surface">
                    {group.transactions.map((tx) => {
                      const cat = categoryMap.get(tx.categoryId);
                      const txType = tx.getType();
                      const isIncome = txType === 'INCOME';
                      const isSaving = txType === 'SAVING';

                      return (
                        <button
                          key={tx.id}
                          type="button"
                          onClick={() => setEditingTx(tx)}
                          className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-slate-50/90 active:bg-slate-100/70 transition-colors"
                        >
                          {/* Bên trái: Icon danh mục (đúng màu) + Tên danh mục & Ghi chú nhỏ */}
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl shadow-sm"
                              style={{
                                backgroundColor: `${cat?.color ?? '#8B5CF6'}18`,
                                color: cat?.color ?? '#8B5CF6',
                              }}
                            >
                              <CategoryIcon
                                iconName={cat?.icon ?? 'MoreHorizontal'}
                                className="h-5 w-5"
                              />
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="truncate text-sm font-bold text-ink-primary">
                                  {cat?.name ?? 'Danh mục khác'}
                                </span>
                                {isSaving && (
                                  <span className="rounded-full bg-lime-100 px-2 py-0.5 text-[10px] font-bold text-lime-800">
                                    Tiết kiệm
                                  </span>
                                )}
                              </div>

                              <p className="truncate text-xs text-ink-secondary mt-0.5">
                                {tx.note ? tx.note : 'Không có ghi chú'} •{' '}
                                <span className="tabular-nums text-ink-muted">
                                  {formatTimeHHMM(tx.timestamp)}
                                </span>
                              </p>
                            </div>
                          </div>

                          {/* Bên phải: Số tiền và dấu > */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span
                              className={cn(
                                'text-sm sm:text-base font-bold tabular-nums',
                                isIncome
                                  ? 'text-semantic-safe'
                                  : isSaving
                                    ? 'text-primary'
                                    : 'text-ink-primary'
                              )}
                            >
                              {isIncome ? '+' : '-'}
                              {tx.amount.formatVND()}
                            </span>
                            <ChevronRight className="h-4 w-4 text-ink-muted" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </SoftCard>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Chỉnh sửa / Xóa Giao dịch */}
      {editingTx && (
        <EditTransactionModal
          transaction={editingTx}
          categories={categories}
          onClose={() => setEditingTx(null)}
          onSave={async (payload) => {
            await updateTransaction(payload);
            setEditingTx(null);
          }}
          onDelete={async (id) => {
            await deleteTransaction(id);
            setEditingTx(null);
          }}
        />
      )}

      {/* Modal Xem Nhật ký Hệ thống (Audit Log) */}
      {isAuditModalOpen && (
        <AuditLogModal
          weekLabel={selectedWeek.formatLabel()}
          logs={auditLogs}
          onClose={() => setIsAuditModalOpen(false)}
        />
      )}
    </div>
  );
};

/**
 * MODAL 1: Chỉnh sửa Số tiền / Ghi chú / Danh mục / Ngày hoặc Xóa giao dịch
 */
interface EditTransactionModalProps {
  transaction: Transaction;
  categories: Category[];
  onClose: () => void;
  onSave: (payload: {
    id: string;
    amount: number;
    categoryId: string;
    timestamp: Date;
    note: string;
  }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const EditTransactionModal: React.FC<EditTransactionModalProps> = ({
  transaction,
  categories,
  onClose,
  onSave,
  onDelete,
}) => {
  const [amountDigits, setAmountDigits] = useState<string>(
    String(transaction.amount.amount)
  );
  const [categoryId, setCategoryId] = useState<string>(transaction.categoryId);
  const [note, setNote] = useState<string>(transaction.note);
  const [dateInputValue, setDateInputValue] = useState<string>(() =>
    toDateKey(transaction.timestamp)
  );
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [confirmDelete, setConfirmDelete] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const numericAmount = amountDigits ? parseInt(amountDigits, 10) : 0;
  const formattedAmount =
    numericAmount > 0 ? formatCompactNumber(numericAmount) : '';

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (numericAmount <= 0) {
      setErrorMsg('Số tiền phải lớn hơn 0đ.');
      return;
    }

    try {
      setIsSaving(true);
      setErrorMsg(null);

      const [y, m, d] = dateInputValue.split('-').map((n) => parseInt(n, 10));
      const updatedTimestamp = new Date(
        y || transaction.timestamp.getFullYear(),
        (m || transaction.timestamp.getMonth() + 1) - 1,
        d || transaction.timestamp.getDate(),
        transaction.timestamp.getHours(),
        transaction.timestamp.getMinutes(),
        transaction.timestamp.getSeconds()
      );

      await onSave({
        id: transaction.id,
        amount: numericAmount,
        categoryId,
        timestamp: updatedTimestamp,
        note: note.trim(),
      });
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Không thể cập nhật giao dịch.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      await onDelete(transaction.id);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Không thể xóa giao dịch.'
      );
      setIsDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      <SoftCard
        padding="none"
        radius="3xl"
        className="w-full max-w-md overflow-hidden rounded-b-none sm:rounded-3xl shadow-soft-md"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="text-base font-bold text-ink-primary">
              Chỉnh sửa giao dịch
            </h3>
            <p className="text-xs text-ink-secondary">
              Mọi thay đổi sẽ tự động cập nhật số dư tuần và lưu vết AuditLog
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-ink-secondary hover:bg-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSave(e)} className="p-5 space-y-4">
          {errorMsg && (
            <div className="rounded-xl bg-semantic-danger-light px-3.5 py-2 text-xs font-semibold text-semantic-danger-dark">
              {errorMsg}
            </div>
          )}

          {/* Số tiền */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-ink-secondary">
              Số tiền giao dịch
            </label>
            <div className="relative flex items-center">
              <input
                type="text"
                inputMode="numeric"
                value={formattedAmount}
                onChange={(e) =>
                  setAmountDigits(e.target.value.replace(/\D/g, ''))
                }
                className="w-full rounded-2xl border border-slate-200 bg-surface-muted pl-4 pr-9 py-3 text-xl font-bold tabular-nums text-ink-primary focus:border-primary focus:bg-white focus:outline-none"
              />
              <span className="absolute right-4 text-sm font-bold text-ink-secondary">
                đ
              </span>
            </div>
          </div>

          {/* Ngày giao dịch */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-ink-secondary">
              Ngày phát sinh
            </label>
            <input
              type="date"
              value={dateInputValue}
              onChange={(e) => setDateInputValue(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-surface-muted px-4 py-2.5 text-sm font-semibold text-ink-primary focus:border-primary focus:bg-white focus:outline-none"
            />
          </div>

          {/* Chọn Danh mục */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-ink-secondary">
              Danh mục
            </label>
            <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto p-0.5">
              {categories.map((cat) => {
                const isSelected = cat.id === categoryId;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategoryId(cat.id)}
                    className={cn(
                      'flex flex-col items-center gap-1 rounded-xl p-2 text-center border transition-all',
                      isSelected
                        ? 'border-primary bg-primary-50 text-primary font-bold'
                        : 'border-slate-100 bg-surface-muted text-ink-secondary'
                    )}
                  >
                    <CategoryIcon iconName={cat.icon} className="h-4 w-4" />
                    <span className="w-full truncate text-[11px]">
                      {cat.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Ghi chú */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-ink-secondary">
              Ghi chú
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Chưa nhập vào"
              className="w-full rounded-2xl border border-slate-200 bg-surface-muted px-4 py-2.5 text-sm font-medium text-ink-primary focus:border-primary focus:bg-white focus:outline-none"
            />
          </div>

          {/* Nút Lưu & Nút Xóa */}
          <div className="pt-2 space-y-2.5">
            <PillButton
              type="submit"
              variant="primary"
              fullWidth
              isLoading={isSaving}
              leftIcon={<Sparkles className="h-4 w-4" />}
            >
              Lưu cập nhật
            </PillButton>

            {!confirmDelete ? (
              <PillButton
                type="button"
                variant="ghost"
                fullWidth
                onClick={() => setConfirmDelete(true)}
                leftIcon={<Trash2 className="h-4 w-4 text-semantic-danger" />}
                className="text-semantic-danger hover:bg-semantic-danger-light/50"
              >
                Xóa giao dịch này
              </PillButton>
            ) : (
              <div className="flex items-center gap-2 rounded-2xl bg-semantic-danger-light/70 p-2">
                <PillButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  fullWidth
                  onClick={() => setConfirmDelete(false)}
                >
                  Hủy
                </PillButton>
                <PillButton
                  type="button"
                  variant="danger"
                  size="sm"
                  fullWidth
                  isLoading={isDeleting}
                  onClick={() => void handleDelete()}
                >
                  Xác nhận xóa
                </PillButton>
              </div>
            )}
          </div>
        </form>
      </SoftCard>
    </div>
  );
};

/**
 * MODAL 2: Xem Nhật ký Hệ thống (Audit Log) của các lần Thêm / Sửa / Xóa
 */
interface AuditLogModalProps {
  weekLabel: string;
  logs: readonly {
    id: string;
    action: 'CREATE' | 'UPDATE' | 'DELETE';
    entityType: string;
    description: string;
    timestamp: Date;
  }[];
  onClose: () => void;
}

const AuditLogModal: React.FC<AuditLogModalProps> = ({
  weekLabel,
  logs,
  onClose,
}) => {
  const getActionBadge = (action: 'CREATE' | 'UPDATE' | 'DELETE') => {
    switch (action) {
      case 'CREATE':
        return {
          label: 'THÊM MỚI',
          className: 'bg-semantic-safe-light text-semantic-safe-dark',
        };
      case 'UPDATE':
        return {
          label: 'CẬP NHẬT',
          className: 'bg-primary-100 text-primary-700',
        };
      case 'DELETE':
        return {
          label: 'ĐÃ XÓA',
          className: 'bg-semantic-danger-light text-semantic-danger-dark',
        };
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      <SoftCard
        padding="none"
        radius="3xl"
        className="w-full max-w-lg max-h-[85dvh] flex flex-col overflow-hidden rounded-b-none sm:rounded-3xl shadow-soft-md"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-50 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-ink-primary">
                Nhật ký Hệ thống (Audit Log)
              </h3>
              <p className="text-xs text-ink-secondary">
                Lịch sử thao tác thêm, sửa, xóa trong tuần {weekLabel}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-ink-secondary hover:bg-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {logs.length === 0 ? (
            <div className="rounded-2xl bg-surface-muted p-8 text-center text-xs text-ink-secondary">
              Chưa có bản ghi Audit Log nào trong tuần này.
            </div>
          ) : (
            logs.map((log) => {
              const badge = getActionBadge(log.action);
              return (
                <div
                  key={log.id}
                  className="rounded-2xl border border-slate-100 bg-surface-muted/70 p-3.5 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        'rounded-full px-2.5 py-0.5 text-[10px] font-bold',
                        badge.className
                      )}
                    >
                      {badge.label}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium tabular-nums text-ink-muted">
                      <Clock className="h-3 w-3" />
                      {formatDayHeaderLabel(log.timestamp)} •{' '}
                      {formatTimeHHMM(log.timestamp)}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm font-medium text-ink-primary leading-relaxed">
                    {log.description}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </SoftCard>
    </div>
  );
};