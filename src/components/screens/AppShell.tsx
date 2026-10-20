// src/components/screens/AppShell.tsx
'use client';

import React, { useEffect, useState } from 'react';
import {
  Bell,
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
import { WeeklyRecapModal } from '@/components/screens/WeeklyRecapModal';
import { SoftCard } from '@/components/ui/SoftCard';
import { WeekPeriod } from '@/core/domain/value-objects/WeekPeriod';
import { cn } from '@/lib/utils';

const LAST_SEEN_RECAP_STORAGE_KEY = 'lastSeenRecapWeekId';

interface NavTabItem {
  id: AppTabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_TABS: readonly NavTabItem[] = [
  { id: 'input', label: 'Nhập vào', icon: PenLine },
  { id: 'calendar', label: 'Lịch', icon: CalendarDays },
  { id: 'analytics', label: 'Báo cáo', icon: PieChart },
  { id: 'budget', label: 'Ngân sách', icon: Wallet },
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

  const [isRecapModalOpen, setIsRecapModalOpen] = useState<boolean>(false);

  const weeklySummary = analytics?.weeklySummary;
  const previousWeekRecap = analytics?.previousWeekRecap;

  // Cơ chế tự động hiển thị Modal vào Thứ Hai hoặc lần đầu tiên mở app trong tuần mới
  useEffect(() => {
    if (isLoading || !previousWeekRecap) return;
    if (typeof window === 'undefined' || !window.localStorage) return;

    const currentRealWeekKey = WeekPeriod.currentWeek().weekKey;
    const isViewingRealCurrentWeek = selectedWeek.weekKey === currentRealWeekKey;
    if (!isViewingRealCurrentWeek) return;

    const lastSeenWeekId = window.localStorage.getItem(
      LAST_SEEN_RECAP_STORAGE_KEY
    );

    // Tự động mở nếu tuần hiện tại chưa từng xem bảng tổng kết VÀ tuần trước đó có phát sinh dữ liệu
    if (lastSeenWeekId !== currentRealWeekKey && previousWeekRecap.hasActivity) {
      setIsRecapModalOpen(true);
    }
  }, [isLoading, previousWeekRecap, selectedWeek]);

  // Đóng Modal và lưu lastSeenRecapWeekId vào LocalStorage
  const handleCloseRecapModal = () => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const currentRealWeekKey = WeekPeriod.currentWeek().weekKey;
      window.localStorage.setItem(
        LAST_SEEN_RECAP_STORAGE_KEY,
        currentRealWeekKey
      );
    }
    setIsRecapModalOpen(false);
  };

  const renderActiveTabContent = (): React.ReactNode => {
    switch (activeTab) {
      case 'input':
        return inputScreen;
      case 'calendar':
        return calendarScreen;
      case 'analytics':
        return analyticsScreen;
      case 'budget':
        return budgetScreen;
    }
  };

  return (
    <div className="min-h-dvh bg-[#F4F7FE] text-[#1E293B] flex flex-col items-center">
      <div className="w-full max-w-[540px] min-h-dvh flex flex-col pb-28">
        {/* Top Sticky Header */}
        <header className="sticky top-0 z-30 pt-safe bg-[#F4F7FE]/90 backdrop-blur-xl px-4 pt-3 pb-2.5 space-y-2.5">
          {/* Hàng 1: Logo thương hiệu + Nút xem lại "Tổng kết tuần trước" */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-[#8B5CF6] to-[#A855F7] text-white shadow-soft-primary">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <h1 className="text-base font-bold tracking-tight text-[#1E293B] leading-none">
                  UniSpend
                </h1>
                <p className="mt-0.5 text-[11px] font-medium text-[#64748B]">
                  Chi tiêu tuần sinh viên
                </p>
              </div>
            </div>

            {/* Nút mở xem lại Bảng Tổng kết Tuần trước bất cứ lúc nào */}
            {previousWeekRecap && (
              <button
                type="button"
                onClick={() => setIsRecapModalOpen(true)}
                title="Xem tổng kết tuần trước"
                className="relative inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-[#6D28D9] shadow-soft border border-slate-100 hover:bg-[#F5F3FF] active:scale-95 transition-all"
              >
                <Bell className="h-3.5 w-3.5 text-[#8B5CF6]" />
                <span>Tổng kết tuần trước</span>
                {previousWeekRecap.hasActivity && (
                  <span className="h-2 w-2 rounded-full bg-[#8B5CF6]" />
                )}
              </button>
            )}
          </div>

          {/* Hàng 2: Thanh điều hướng tuần < Tuần DD/MM - DD/MM/YYYY > */}
          <div className="flex items-center gap-2">
            {!isCurrentWeek && (
              <button
                type="button"
                onClick={() => navigateWeek('current')}
                className="inline-flex items-center gap-1 rounded-full bg-[#EDE9FE] px-3 py-1.5 text-xs font-bold text-[#6D28D9] hover:bg-[#DDD6FE] active:scale-95 transition-all shrink-0"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Tuần này</span>
              </button>
            )}

            <div className="flex flex-1 items-center justify-between rounded-full bg-white px-1.5 py-1 shadow-soft border border-slate-100">
              <button
                type="button"
                onClick={() => navigateWeek('prev')}
                aria-label="Tuần trước"
                className="flex h-7 w-7 items-center justify-center rounded-full text-[#64748B] hover:bg-slate-100 hover:text-[#1E293B] active:scale-90 transition-all"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <span className="text-xs sm:text-sm font-bold tabular-nums text-[#1E293B]">
                Tuần {selectedWeek.formatLabel()}
              </span>

              <button
                type="button"
                onClick={() => navigateWeek('next')}
                aria-label="Tuần kế tiếp"
                className="flex h-7 w-7 items-center justify-center rounded-full text-[#64748B] hover:bg-slate-100 hover:text-[#1E293B] active:scale-90 transition-all"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </header>

        {/* Nội dung chính của từng Tab */}
        <main className="flex-1 px-4 pt-1 space-y-4">
          {error && (
            <div className="flex items-center justify-between rounded-2xl bg-[#FEE2E2] px-4 py-3 text-xs font-semibold text-[#B91C1C]">
              <span>{error}</span>
              <button
                type="button"
                onClick={clearError}
                className="ml-3 rounded-full bg-white px-2.5 py-1 text-xs font-bold text-[#B91C1C]"
              >
                Đóng
              </button>
            </div>
          )}

          {/* 3 Thẻ Tóm tắt Nhanh đầu trang */}
          {weeklySummary && (
            <div className="grid grid-cols-3 gap-2.5">
              <SoftCard padding="sm" className="bg-white">
                <span className="block text-[11px] font-medium text-[#64748B]">
                  Ngân sách tuần
                </span>
                <span className="mt-1 block text-sm font-bold tabular-nums text-[#1E293B]">
                  {weeklySummary.totalWeeklyAvailable.formatVND()}
                </span>
              </SoftCard>

              <SoftCard padding="sm" className="bg-white">
                <span className="block text-[11px] font-medium text-[#64748B]">
                  Đã chi tuần
                </span>
                <span className="mt-1 block text-sm font-bold tabular-nums text-[#F97316]">
                  {weeklySummary.totalWeeklyExpense.formatVND()}
                </span>
              </SoftCard>

              <SoftCard padding="sm" className="bg-white">
                <span className="block text-[11px] font-medium text-[#64748B]">
                  Còn lại tuần
                </span>
                <span
                  className={cn(
                    'mt-1 block text-sm font-bold tabular-nums',
                    weeklySummary.remainingWeeklyBalance.isNegative()
                      ? 'text-[#EF4444]'
                      : 'text-[#10B981]'
                  )}
                >
                  {weeklySummary.remainingWeeklyBalance.formatVND()}
                </span>
              </SoftCard>
            </div>
          )}

          {isLoading && !analytics ? (
            <SoftCard
              padding="lg"
              className="flex flex-col items-center justify-center py-16 bg-white"
            >
              <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#8B5CF6] border-t-transparent" />
              <p className="mt-3 text-xs font-semibold text-[#64748B]">
                Đang đồng bộ dữ liệu tuần...
              </p>
            </SoftCard>
          ) : (
            renderActiveTabContent()
          )}
        </main>
      </div>

      {/* Bottom Navigation Bar cố định dạng Floating Dock */}
      <nav
        aria-label="Điều hướng chính"
        className="fixed bottom-0 inset-x-0 z-40 pb-safe pointer-events-none flex justify-center px-4 pb-3"
      >
        <div className="pointer-events-auto flex w-full max-w-[508px] items-center justify-around rounded-3xl bg-white/95 backdrop-blur-xl px-2 py-2 shadow-soft-md border border-slate-200/80">
          {NAV_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex flex-1 flex-col items-center justify-center gap-1 rounded-2xl py-1.5 px-2 select-none transition-all duration-200 active:scale-95',
                  isActive
                    ? 'text-[#8B5CF6]'
                    : 'text-[#64748B] hover:text-[#1E293B]'
                )}
              >
                <div
                  className={cn(
                    'flex h-8 w-12 items-center justify-center rounded-full transition-all duration-200',
                    isActive
                      ? 'bg-[#EDE9FE] text-[#8B5CF6]'
                      : 'bg-transparent'
                  )}
                >
                  <Icon
                    className={cn(
                      'h-4 w-4 transition-transform',
                      isActive && 'scale-110 stroke-[2.5px]'
                    )}
                  />
                </div>
                <span
                  className={cn(
                    'text-[11px] leading-none',
                    isActive ? 'font-bold text-[#8B5CF6]' : 'font-medium'
                  )}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Modal Bảng Thông báo & Thống kê Đầu tuần (Monday Weekly Recap) */}
      {previousWeekRecap && (
        <WeeklyRecapModal
          isOpen={isRecapModalOpen}
          recap={previousWeekRecap}
          onAcknowledgeAndClose={handleCloseRecapModal}
        />
      )}
    </div>
  );
};