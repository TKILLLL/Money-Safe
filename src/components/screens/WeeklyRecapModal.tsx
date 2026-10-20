// src/components/screens/WeeklyRecapModal.tsx
'use client';

import React from 'react';
import {
  Landmark,
  Sparkles,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react';
import { PillButton } from '@/components/ui/PillButton';
import { SoftCard } from '@/components/ui/SoftCard';
import type { PreviousWeekRecapMetrics } from '@/core/application/use-cases/CalculateWeeklyAnalyticsUseCase';
import { cn } from '@/lib/utils';

export interface WeeklyRecapModalProps {
  isOpen: boolean;
  recap: PreviousWeekRecapMetrics;
  onAcknowledgeAndClose: () => void;
}

export const WeeklyRecapModal: React.FC<WeeklyRecapModalProps> = ({
  isOpen,
  recap,
  onAcknowledgeAndClose,
}) => {
  if (!isOpen) return null;

  const isDeficit = recap.remainingWeeklyBalance.isNegative();
  const hasSavings = recap.savedAmount.isPositive();

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/45 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="weekly-recap-title"
    >
      <SoftCard
        padding="none"
        radius="3xl"
        className="w-full max-w-md overflow-hidden rounded-b-none sm:rounded-3xl bg-white shadow-soft-md border border-slate-200/80"
      >
        {/* Top Decorative Lavender Header */}
        <div className="relative bg-gradient-to-br from-[#F5F3FF] via-white to-[#EDE9FE] px-5 pt-6 pb-5 border-b border-primary-100/80">
          <button
            type="button"
            onClick={onAcknowledgeAndClose}
            aria-label="Đóng"
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-ink-secondary hover:bg-white hover:text-ink-primary shadow-xs transition-colors"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex flex-col items-center text-center space-y-2.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#8B5CF6] to-[#A855F7] text-white shadow-soft-primary">
              <Sparkles className="h-6 w-6" />
            </div>

            <span className="inline-flex items-center gap-1 rounded-full bg-primary-100/90 px-3 py-0.5 text-[11px] font-bold text-primary-700">
              Báo cáo đầu tuần mới
            </span>

            <h2
              id="weekly-recap-title"
              className="text-base sm:text-lg font-bold text-ink-primary leading-snug"
            >
              Tổng kết Tuần trước ({recap.weekLabel})
            </h2>

            <p className="text-xs text-ink-secondary max-w-xs">
              Cùng nhìn lại kết quả quản lý tài chính của bạn trước khi bắt đầu chu kỳ tuần mới!
            </p>
          </div>
        </div>

        {/* Modal Body: Highlight Cards & Comparison Row */}
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Khối 1: Đã tiết kiệm được (Tông màu xanh lá / tím tích cực) */}
            <div className="rounded-2xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50/90 via-white to-primary-50/60 p-4 space-y-2 shadow-soft">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-800">
                  Đã tiết kiệm được
                </span>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600">
                  <Landmark className="h-4 w-4" />
                </div>
              </div>

              <p className="text-xl font-bold tabular-nums text-emerald-600">
                {recap.savedAmount.formatVND()}
              </p>

              <p className="text-[11px] font-medium text-ink-secondary">
                {hasSavings
                  ? 'Tuyệt vời! Bạn đã duy trì kỷ luật tích lũy.'
                  : 'Chưa có khoản trích tiết kiệm nào tuần qua.'}
              </p>
            </div>

            {/* Khối 2: Số dư còn lại tuần trước (Hiển thị rõ dư hoặc vượt chi) */}
            <div
              className={cn(
                'rounded-2xl border p-4 space-y-2 shadow-soft',
                isDeficit
                  ? 'border-red-200/80 bg-gradient-to-br from-red-50/80 via-white to-orange-50/40'
                  : 'border-primary-200/80 bg-gradient-to-br from-primary-50/80 via-white to-indigo-50/40'
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    'text-xs font-bold',
                    isDeficit ? 'text-red-800' : 'text-primary-700'
                  )}
                >
                  Số dư còn lại tuần trước
                </span>
                <div
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-xl',
                    isDeficit
                      ? 'bg-red-500/15 text-semantic-danger'
                      : 'bg-primary/15 text-primary'
                  )}
                >
                  {isDeficit ? (
                    <Wallet className="h-4 w-4" />
                  ) : (
                    <TrendingUp className="h-4 w-4" />
                  )}
                </div>
              </div>

              <p
                className={cn(
                  'text-xl font-bold tabular-nums',
                  isDeficit ? 'text-semantic-danger' : 'text-primary'
                )}
              >
                {recap.remainingWeeklyBalance.formatVND()}
              </p>

              <p className="text-[11px] font-medium text-ink-secondary">
                {isDeficit
                  ? 'Vượt chi so với ngân sách tuần trước.'
                  : 'Chi tiêu nằm trong phạm vi ngân sách an toàn.'}
              </p>
            </div>
          </div>

          {/* Dòng đối chiếu nhỏ bên dưới: Ngân sách tuần trước | Tổng đã chi */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-surface-muted px-4 py-3 text-xs border border-slate-200/60">
            <span className="text-ink-secondary">
              Ngân sách tuần trước:{' '}
              <strong className="font-bold tabular-nums text-ink-primary">
                {recap.totalWeeklyAvailable.formatVND()}
              </strong>
            </span>
            <span className="text-slate-300 hidden sm:inline">|</span>
            <span className="text-ink-secondary">
              Tổng đã chi:{' '}
              <strong className="font-bold tabular-nums text-semantic-warning">
                {recap.totalWeeklyExpense.formatVND()}
              </strong>
            </span>
          </div>

          {/* Nút CTA dáng Pill ở dưới cùng */}
          <div className="pt-1">
            <PillButton
              type="button"
              variant="primary"
              size="lg"
              fullWidth
              onClick={onAcknowledgeAndClose}
              leftIcon={<Sparkles className="h-4 w-4" />}
              className="font-bold shadow-soft-primary"
            >
              Đã hiểu &amp; Bắt đầu tuần mới
            </PillButton>
          </div>
        </div>
      </SoftCard>
    </div>
  );
};