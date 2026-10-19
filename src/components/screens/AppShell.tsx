// src/components/screens/AppShell.tsx
'use client';

import React from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  PenLine,
  PieChart,
  RotateCcw,
  Sparkles,
  Wallet,
} from 'lucide-react';
import {
  type AppTabId,
  useExpenseTracker,
} from '@/components/providers/ExpenseTrackerProvider';
import { PillButton } from '@/components/ui/PillButton';
import { SoftCard } from '@/components/ui/SoftCard';
import { cn } from '@/lib/utils';

interface NavTabItem {
  id: AppTabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const NAV_TABS: readonly NavTabItem[] = [
  {
    id: 'input',
    label: 'Nhập vào',
    icon: PenLine,
    description: 'Ghi chép thu chi & hạn mức an toàn hôm nay',
  },
  {
    id: 'calendar',
    label: 'Lịch',
    icon: CalendarDays,
    description: 'Theo dõi dòng tiền theo lịch tuần & nhật ký',
  },
  {
    id: 'analytics',
    label: 'Báo cáo',
    icon: PieChart,
    description: 'Biểu đồ phân tích tỷ trọng & xu hướng tuần',
  },
  {
    id: 'budget',
    label: 'Ngân sách',
    icon: Wallet,
    description: 'Quản lý chu cấp tuần, danh mục & hạn mức',
  },
];

export interface AppShellProps {
  inputScreen?: React.ReactNode;
  calendarScreen?: React.ReactNode;
  analyticsScreen?: React.ReactNode;
  budgetScreen?: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  inputScreen,
  calendarScreen,
  analyticsScreen,
  budgetScreen,
}) => {
  const {
    activeTab,
    setActiveTab,
    selectedWeek,
    navigateWeek,
    isCurrentWeek,
    analytics,
    isLoading,
    error,
    clearError,
  } = useExpenseTracker();

  const dailySafe = analytics?.dailySafeToSpend;
  const weeklySummary = analytics?.weeklySummary;

  const renderActiveTabContent = (): React.ReactNode => {
    switch (activeTab) {
      case 'input':
        return (
          inputScreen ?? (
            <TabPlaceholder
              tab={NAV_TABS[0]}
              stepLabel="Bước 7/10: Màn hình Nhập vào (Input Screen)"
            />
          )
        );
      case 'calendar':
        return (
          calendarScreen ?? (
            <TabPlaceholder
              tab={NAV_TABS[1]}
              stepLabel="Bước 8/10: Màn hình Lịch & Lịch sử Tuần (Calendar Screen)"
            />
          )
        );
      case 'analytics':
        return (
          analyticsScreen ?? (
            <TabPlaceholder
              tab={NAV_TABS[2]}
              stepLabel="Bước 9/10: Màn hình Báo cáo & Phân tích (Analytics Screen)"
            />
          )
        );
      case 'budget':
        return (
          budgetScreen ?? (
            <TabPlaceholder
              tab={NAV_TABS[3]}
              stepLabel="Bước 10/10: Màn hình Ngân sách & Danh mục (Budget Screen)"
            />
          )
        );
    }
  };

  return (
    <div className="min-h-dvh bg-background text-ink-primary flex flex-col">
      {/* Top Sticky Header Bar (iPhone & MacBook) */}
      <header className="sticky top-0 z-30 pt-safe bg-background/85 backdrop-blur-xl border-b border-slate-200/60">
        <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 py-3">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            {/* Brand & Quick Daily Allowance Badge */}
            <div className="flex items-center justify-between sm:justify-start gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary-accent text-white shadow-soft-primary">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-base sm:text-lg font-bold tracking-tight text-ink-primary leading-tight">
                    UniSpend
                  </h1>
                  <p className="text-[11px] font-medium text-ink-secondary">
                    Chi tiêu tuần sinh viên
                  </p>
                </div>
              </div>

              {/* Quick Safe-to-Spend Pill on Mobile & Desktop */}
              {dailySafe && (
                <div
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border transition-colors',
                    dailySafe.isOverspentToday
                      ? 'bg-semantic-danger-light/70 text-semantic-danger-dark border-semantic-danger/20'
                      : 'bg-semantic-safe-light/70 text-semantic-safe-dark border-semantic-safe/20'
                  )}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  <span>Hôm nay còn: {dailySafe.todayRemaining.formatVND()}</span>
                </div>
              )}
            </div>

            {/* Shared Week Period Selector: < Tuần DD/MM - DD/MM/YYYY > */}
            <div className="flex items-center justify-between sm:justify-end gap-2">
              {!isCurrentWeek && (
                <button
                  type="button"
                  onClick={() => navigateWeek('current')}
                  className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary-100 active:scale-95 transition-all"
                  title="Quay về tuần hiện tại"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Tuần này</span>
                </button>
              )}

              <div className="flex flex-1 sm:flex-initial items-center justify-between rounded-full bg-surface px-1.5 py-1 shadow-soft border border-slate-100">
                <button
                  type="button"
                  onClick={() => navigateWeek('prev')}
                  aria-label="Tuần trước"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-ink-secondary hover:bg-slate-100 hover:text-ink-primary active:scale-90 transition-all"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                <div className="px-3 text-center">
                  <span className="text-xs sm:text-sm font-bold tabular-nums text-ink-primary">
                    Tuần {selectedWeek.formatLabel()}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => navigateWeek('next')}
                  aria-label="Tuần kế tiếp"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-ink-secondary hover:bg-slate-100 hover:text-ink-primary active:scale-90 transition-all"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 sm:px-6 pt-4 pb-28 sm:pb-32">
        {/* Global Error Banner (nếu phát sinh lỗi Domain/Validation) */}
        {error && (
          <div className="mb-4 flex items-center justify-between rounded-2xl bg-semantic-danger-light px-4 py-3 text-xs sm:text-sm font-medium text-semantic-danger-dark border border-semantic-danger/20">
            <span>{error}</span>
            <button
              type="button"
              onClick={clearError}
              className="ml-3 rounded-full bg-white/80 px-2.5 py-1 text-xs font-bold text-semantic-danger-dark hover:bg-white"
            >
              Đóng
            </button>
          </div>
        )}

        {/* Quick Status Strip on MacBook / iPhone */}
        {weeklySummary && dailySafe && (
          <div className="mb-5 grid grid-cols-3 gap-2.5 sm:gap-4">
            <SoftCard padding="sm" className="flex flex-col justify-between">
              <span className="text-[11px] font-medium text-ink-secondary">
                Ngân sách tuần
              </span>
              <span className="mt-1 text-sm sm:text-base font-bold tabular-nums text-ink-primary">
                {weeklySummary.totalWeeklyAvailable.formatVND()}
              </span>
            </SoftCard>

            <SoftCard padding="sm" className="flex flex-col justify-between">
              <span className="text-[11px] font-medium text-ink-secondary">
                Đã chi trong tuần
              </span>
              <span className="mt-1 text-sm sm:text-base font-bold tabular-nums text-semantic-warning">
                {weeklySummary.totalWeeklyExpense.formatVND()}
              </span>
            </SoftCard>

            <SoftCard padding="sm" className="flex flex-col justify-between">
              <span className="text-[11px] font-medium text-ink-secondary">
                Còn lại tuần này
              </span>
              <span
                className={cn(
                  'mt-1 text-sm sm:text-base font-bold tabular-nums',
                  weeklySummary.remainingWeeklyBalance.isNegative()
                    ? 'text-semantic-danger'
                    : 'text-semantic-safe'
                )}
              >
                {weeklySummary.remainingWeeklyBalance.formatVND()}
              </span>
            </SoftCard>
          </div>
        )}

        {/* Active Tab View */}
        {isLoading && !analytics ? (
          <SoftCard padding="lg" className="flex flex-col items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-primary border-t-transparent" />
            <p className="mt-3 text-sm font-medium text-ink-secondary">
              Đang đồng bộ chu kỳ tài chính tuần...
            </p>
          </SoftCard>
        ) : (
          renderActiveTabContent()
        )}
      </main>

      {/* Fixed Bottom Navigation Bar (4 Primary Tabs - Apple HIG Dock Style) */}
      <nav
        aria-label="Điều hướng chính"
        className="fixed bottom-0 inset-x-0 z-40 pb-safe bg-surface/90 backdrop-blur-xl border-t border-slate-200/70 shadow-soft-md"
      >
        <div className="mx-auto flex max-w-lg items-center justify-around px-2 py-2">
          {NAV_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'group relative flex flex-1 flex-col items-center justify-center gap-1 rounded-2xl py-2 px-3 select-none',
                  'transition-all duration-200 ease-apple-spring active:scale-95',
                  isActive
                    ? 'text-primary'
                    : 'text-ink-secondary hover:text-ink-primary'
                )}
              >
                <div
                  className={cn(
                    'flex h-8 w-12 items-center justify-center rounded-full transition-all duration-200',
                    isActive
                      ? 'bg-primary-100/90 text-primary shadow-sm'
                      : 'bg-transparent group-hover:bg-slate-100'
                  )}
                >
                  <Icon
                    className={cn(
                      'h-5 w-5 transition-transform duration-200',
                      isActive && 'scale-105 stroke-[2.4px]'
                    )}
                  />
                </div>
                <span
                  className={cn(
                    'text-[11px] tracking-tight transition-all',
                    isActive ? 'font-bold text-primary' : 'font-medium'
                  )}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

/**
 * Placeholder Component tạm thời cho từng Tab ở Bước 6
 * (Sẽ được thay thế bằng các màn hình chi tiết ở Bước 7, 8, 9, 10)
 */
interface TabPlaceholderProps {
  tab: NavTabItem;
  stepLabel: string;
}

const TabPlaceholder: React.FC<TabPlaceholderProps> = ({ tab, stepLabel }) => {
  const { analytics, categories, selectedWeek, navigateWeek } = useExpenseTracker();
  const Icon = tab.icon;

  return (
    <SoftCard padding="lg" radius="3xl" className="text-center space-y-5">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-primary-50 text-primary shadow-inner-soft">
        <Icon className="h-8 w-8" />
      </div>

      <div className="space-y-1.5 max-w-md mx-auto">
        <span className="inline-block rounded-full bg-primary-100 px-3 py-1 text-xs font-bold text-primary-700">
          {stepLabel}
        </span>
        <h2 className="text-xl font-bold text-ink-primary">
          Tab &ldquo;{tab.label}&rdquo; đã kết nối Core OOP
        </h2>
        <p className="text-sm text-ink-secondary">{tab.description}</p>
      </div>

      {analytics && (
        <div className="mx-auto max-w-lg rounded-2xl bg-surface-muted p-4 text-left text-xs space-y-2 border border-slate-200/60">
          <div className="flex justify-between">
            <span className="text-ink-secondary">Chu kỳ đang chọn:</span>
            <span className="font-bold text-ink-primary">
              {selectedWeek.formatLabel()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-secondary">Định mức được tiêu hôm nay:</span>
            <span className="font-bold text-primary">
              {analytics.dailySafeToSpend.dailyAllowance.formatVND()} (Còn{' '}
              {analytics.dailySafeToSpend.remainingDays} ngày)
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-secondary">Số danh mục đang hoạt động:</span>
            <span className="font-bold text-ink-primary">
              {categories.length} danh mục
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-secondary">Số giao dịch trong tuần:</span>
            <span className="font-bold text-ink-primary">
              {analytics.recentTransactions.length} giao dịch
            </span>
          </div>
        </div>
      )}

      <div className="flex items-center justify-center gap-3 pt-1">
        <PillButton
          variant="secondary"
          size="sm"
          onClick={() => navigateWeek('prev')}
        >
          Xem tuần trước
        </PillButton>
        <PillButton
          variant="primary"
          size="sm"
          onClick={() => navigateWeek('current')}
        >
          Về tuần hiện tại
        </PillButton>
      </div>
    </SoftCard>
  );
};