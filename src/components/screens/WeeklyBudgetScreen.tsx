// src/components/screens/WeeklyBudgetScreen.tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Cloud,
  Download,
  HardDrive,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import { useExpenseTracker } from '@/components/providers/ExpenseTrackerProvider';
import { CategoryIcon } from '@/components/ui/CategoryIcon';
import { PillButton } from '@/components/ui/PillButton';
import { SoftCard } from '@/components/ui/SoftCard';
import type { Category } from '@/core/domain/entities/Category';
import { BackupService } from '@/core/infrastructure/BackupService';
import { DIContainer } from '@/core/infrastructure/di/DIContainer';
import { cn } from '@/lib/utils';

function formatDigitsWithComma(digits: string): string {
  if (!digits) return '';
  const num = parseInt(digits, 10);
  if (Number.isNaN(num) || num <= 0) return '';
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export const WeeklyBudgetScreen: React.FC = () => {
  const {
    selectedWeek,
    navigateWeek,
    analytics,
    categories,
    updateWeeklyAllowance,
    resetAllDataToZero,
    refreshData,
  } = useExpenseTracker();

  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [bannerNotice, setBannerNotice] = useState<string | null>(null);

  const isCloudEnabled = DIContainer.getInstance().isCloudSyncEnabled;

  useEffect(() => {
    if (!bannerNotice) return;
    const timer = setTimeout(() => setBannerNotice(null), 3500);
    return () => clearTimeout(timer);
  }, [bannerNotice]);

  const summary = analytics?.weeklySummary;
  const categoryBudgets = analytics?.categoryBudgets ?? [];

  const masterUsagePct = summary?.weeklyUsagePercentage ?? 0;
  const clampedMasterWidth = Math.min(Math.max(masterUsagePct, 0), 100);

  const masterBarColor =
    masterUsagePct >= 100
      ? 'bg-semantic-danger'
      : masterUsagePct >= 75
        ? 'bg-semantic-warning'
        : 'bg-gradient-to-r from-primary to-semantic-safe';

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* 1. HEADER & CÀI ĐẶT CHU CẤP ĐẦU TUẦN */}
      <SoftCard padding="sm" radius="2xl">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1 rounded-full bg-surface-muted px-2 py-1 border border-slate-200/70">
            <button
              type="button"
              onClick={() => navigateWeek('prev')}
              aria-label="Tuần trước"
              className="flex h-7 w-7 items-center justify-center rounded-full text-ink-secondary hover:bg-white hover:text-primary active:scale-90 transition-all"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-2.5 text-xs sm:text-sm font-bold tabular-nums text-ink-primary">
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

          <PillButton
            variant="secondary"
            size="sm"
            leftIcon={<SlidersHorizontal className="h-3.5 w-3.5" />}
            onClick={() => setIsSettingsOpen(true)}
          >
            Cài đặt ngân sách
          </PillButton>
        </div>
      </SoftCard>

      {/* Thông báo khi cập nhật ngân sách hoặc làm mới dữ liệu thành công */}
      {bannerNotice && (
        <div className="flex items-center gap-2 rounded-2xl bg-semantic-safe-light/90 px-4 py-3 text-xs sm:text-sm font-bold text-semantic-safe-dark border border-semantic-safe/25 shadow-soft">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-semantic-safe" />
          <span>{bannerNotice}</span>
        </div>
      )}

      {/* 2. THẺ "TỔNG NGÂN SÁCH TUẦN" (MASTER BUDGET CARD) */}
      {summary && (
        <SoftCard
          padding="md"
          radius="3xl"
          className="space-y-3.5 border-2 border-primary/15 bg-gradient-to-br from-white via-white to-primary-50/40"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-primary" />
              <h2 className="text-base sm:text-lg font-bold text-ink-primary">
                Tổng ngân sách tuần
              </h2>
            </div>

            <span
              className={cn(
                'text-base sm:text-lg font-bold tabular-nums',
                summary.remainingWeeklyBalance.isNegative()
                  ? 'text-semantic-danger'
                  : 'text-semantic-safe'
              )}
            >
              Còn lại: {summary.remainingWeeklyBalance.formatVND()}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div
              role="progressbar"
              aria-valuenow={masterUsagePct}
              aria-valuemin={0}
              aria-valuemax={100}
              className="h-3.5 flex-1 overflow-hidden rounded-full bg-slate-200/75 shadow-inner-soft"
            >
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500 ease-apple-spring',
                  masterBarColor
                )}
                style={{ width: `${clampedMasterWidth}%` }}
              />
            </div>

            <span
              className={cn(
                'w-12 text-right text-xs sm:text-sm font-bold tabular-nums shrink-0',
                masterUsagePct >= 100
                  ? 'text-semantic-danger'
                  : masterUsagePct >= 75
                    ? 'text-semantic-warning'
                    : 'text-primary'
              )}
            >
              {masterUsagePct}%
            </span>
          </div>

          <div className="flex items-center justify-between text-xs sm:text-sm text-ink-secondary pt-0.5">
            <span>
              Chu cấp tuần:{' '}
              <strong className="font-bold text-ink-primary tabular-nums">
                {summary.totalWeeklyAvailable.formatVND()}
              </strong>
            </span>
            <span>
              Đã chi:{' '}
              <strong className="font-bold text-semantic-warning tabular-nums">
                {summary.totalWeeklyExpense.formatVND()}
              </strong>
            </span>
          </div>
        </SoftCard>
      )}

      {/* 3. DANH SÁCH NGÂN SÁCH THEO DANH MỤC (CATEGORY BUDGET CARDS) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-ink-secondary">
            Ngân sách theo Danh mục ({categoryBudgets.length})
          </h3>
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="text-xs font-bold text-primary hover:underline"
          >
            Chỉnh hạn mức
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {categoryBudgets.map((item) => {
            const clampedPct = Math.min(Math.max(item.usagePercentage, 0), 100);
            const isOver = item.status === 'OVER_LIMIT' || item.remaining.isNegative();
            const isWarning = item.status === 'WARNING';

            const barColorClass = isOver
              ? 'bg-semantic-danger'
              : isWarning
                ? 'bg-semantic-warning'
                : 'bg-semantic-safe';

            const pctColorClass = isOver
              ? 'text-semantic-danger'
              : isWarning
                ? 'text-semantic-warning'
                : 'text-semantic-safe';

            return (
              <SoftCard
                key={item.categoryId}
                padding="md"
                radius="2xl"
                interactive
                onClick={() => setIsSettingsOpen(true)}
                className="space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                      style={{
                        backgroundColor: `${item.color}18`,
                        color: item.color,
                      }}
                    >
                      <CategoryIcon iconName={item.icon} className="h-4 w-4" />
                    </div>
                    <span className="truncate text-sm font-bold text-ink-primary">
                      {item.categoryName}
                    </span>
                  </div>

                  <span
                    className={cn(
                      'text-xs sm:text-sm font-bold tabular-nums shrink-0',
                      isOver ? 'text-semantic-danger' : 'text-ink-primary'
                    )}
                  >
                    {item.hasLimit
                      ? `Còn lại: ${item.remaining.formatVND()}`
                      : 'Không giới hạn'}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <div
                    role="progressbar"
                    aria-valuenow={item.usagePercentage}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100 shadow-inner-soft"
                  >
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-500 ease-apple-spring',
                        barColorClass
                      )}
                      style={{ width: `${item.hasLimit ? clampedPct : 0}%` }}
                    />
                  </div>

                  <span
                    className={cn(
                      'w-10 text-right text-xs font-bold tabular-nums shrink-0',
                      pctColorClass
                    )}
                  >
                    {item.hasLimit ? `${item.usagePercentage}%` : '-'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-ink-secondary">
                  <span>
                    Ngân sách mục:{' '}
                    <strong className="font-semibold text-ink-primary tabular-nums">
                      {item.hasLimit ? item.weeklyLimit.formatVND() : '0đ'}
                    </strong>
                  </span>
                  <span>
                    Chi tiêu mục:{' '}
                    <strong className="font-semibold text-ink-primary tabular-nums">
                      {item.spent.formatVND()}
                    </strong>
                  </span>
                </div>
              </SoftCard>
            );
          })}
        </div>
      </div>

      {/* Modal Cài đặt Ngân sách & Sao lưu */}
      {isSettingsOpen && summary && (
        <BudgetSettingsModal
          initialWeeklyAllowance={summary.weeklyAllowance.amount}
          initialOpeningBalance={summary.openingBalance.amount}
          isCloudEnabled={isCloudEnabled}
          categories={categories.filter(
            (c) => c.type === 'EXPENSE' || c.type === 'SAVING'
          )}
          snapshotLimits={Object.fromEntries(
            categoryBudgets.map((item) => [
              item.categoryId,
              item.weeklyLimit.amount,
            ])
          )}
          onClose={() => setIsSettingsOpen(false)}
          onSaveAll={async (payload) => {
            await updateWeeklyAllowance(
              payload.weeklyAllowance,
              payload.openingBalance,
              payload.categoryLimits
            );

            setIsSettingsOpen(false);
            setBannerNotice(
              'Đã lưu ngân sách cho tuần này và tương lai (các tuần trước được giữ nguyên)!'
            );
          }}
          onResetAllToZero={async () => {
            await resetAllDataToZero();
            setIsSettingsOpen(false);
            setBannerNotice(
              'Đã xoá toàn bộ giao dịch và đưa ngân sách tuần, hạn mức các danh mục về 0đ!'
            );
          }}
          onBackupRestored={async (message) => {
            await refreshData();
            setIsSettingsOpen(false);
            setBannerNotice(message);
          }}
        />
      )}
    </div>
  );
};

interface BudgetSettingsModalProps {
  initialWeeklyAllowance: number;
  initialOpeningBalance: number;
  isCloudEnabled: boolean;
  categories: Category[];
  snapshotLimits: Record<string, number>;
  onClose: () => void;
  onSaveAll: (payload: {
    weeklyAllowance: number;
    openingBalance: number;
    categoryLimits: { id: string; limitAmount: number }[];
  }) => Promise<void>;
  onResetAllToZero: () => Promise<void>;
  onBackupRestored: (message: string) => Promise<void>;
}

const BudgetSettingsModal: React.FC<BudgetSettingsModalProps> = ({
  initialWeeklyAllowance,
  initialOpeningBalance,
  isCloudEnabled,
  categories,
  snapshotLimits,
  onClose,
  onSaveAll,
  onResetAllToZero,
  onBackupRestored,
}) => {
  const [allowanceDigits, setAllowanceDigits] = useState<string>(
    initialWeeklyAllowance > 0 ? String(initialWeeklyAllowance) : ''
  );
  const [openingDigits, setOpeningDigits] = useState<string>(
    initialOpeningBalance !== 0 ? String(Math.abs(initialOpeningBalance)) : ''
  );

  const [limitMap, setLimitMap] = useState<Record<string, string>>(() => {
    const record: Record<string, string> = {};
    for (const c of categories) {
      const effectiveAmount =
        snapshotLimits[c.id] !== undefined
          ? snapshotLimits[c.id]
          : c.weeklyLimit.amount;
      record[c.id] = effectiveAmount > 0 ? String(effectiveAmount) : '';
    }
    return record;
  });

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [confirmReset, setConfirmReset] = useState<boolean>(false);
  const [isResetting, setIsResetting] = useState<boolean>(false);
  const [backupError, setBackupError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleCategoryLimitChange = (catId: string, rawValue: string) => {
    const digits = rawValue.replace(/\D/g, '');
    setLimitMap((prev) => ({ ...prev, [catId]: digits }));
  };

  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBackupError(null);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = String(event.target?.result ?? '');
        const summary = BackupService.importFromJsonString(content);
        await onBackupRestored(
          `Đã khôi phục thành công ${summary.transactionsCount} giao dịch, ${summary.categoriesCount} danh mục và ${summary.weeklyCyclesCount} chu kỳ tuần!`
        );
      } catch (err) {
        setBackupError(
          err instanceof Error
            ? err.message
            : 'Không thể đọc file sao lưu JSON.'
        );
      }
    };
    reader.readAsText(file);
  };

  const handleExecuteResetToZero = async () => {
    setIsResetting(true);
    setBackupError(null);
    try {
      // Đưa toàn bộ state input trong modal về 0 trước khi đóng
      setAllowanceDigits('');
      setOpeningDigits('');
      const clearedLimits: Record<string, string> = {};
      for (const c of categories) {
        clearedLimits[c.id] = '';
      }
      setLimitMap(clearedLimits);

      await onResetAllToZero();
    } catch (err) {
      setBackupError(
        err instanceof Error
          ? err.message
          : 'Không thể làm mới dữ liệu về 0.'
      );
      setIsResetting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const allowanceAmount = allowanceDigits ? parseInt(allowanceDigits, 10) : 0;
      const openingAmount = openingDigits ? parseInt(openingDigits, 10) : 0;

      const categoryLimits = categories.map((cat) => ({
        id: cat.id,
        limitAmount: limitMap[cat.id] ? parseInt(limitMap[cat.id], 10) : 0,
      }));

      await onSaveAll({
        weeklyAllowance: allowanceAmount,
        openingBalance: openingAmount,
        categoryLimits,
      });
    } finally {
      setIsSaving(false);
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
        className="w-full max-w-lg max-h-[90dvh] flex flex-col overflow-hidden rounded-b-none sm:rounded-3xl shadow-soft-md"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-ink-primary">
              Cài đặt Ngân sách & Sao lưu
            </h3>
            <p className="text-xs text-ink-secondary">
              Cấu hình mặc định tự động áp dụng khi bước sang tuần mới
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

        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="flex-1 overflow-y-auto p-5 space-y-5"
        >
          {/* 1. Tiền chu cấp đầu tuần & Số dư đầu tuần */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-ink-secondary">
                Chu cấp đầu tuần (weeklyAllowance)
              </label>
              <div className="relative flex items-center">
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatDigitsWithComma(allowanceDigits)}
                  onChange={(e) =>
                    setAllowanceDigits(e.target.value.replace(/\D/g, ''))
                  }
                  placeholder="0"
                  className="w-full rounded-2xl border border-slate-200 bg-surface-muted pl-4 pr-9 py-2.5 text-base font-bold tabular-nums text-ink-primary focus:border-primary focus:bg-white focus:outline-none"
                />
                <span className="absolute right-3.5 text-xs font-bold text-ink-secondary">
                  đ
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-ink-secondary">
                Số dư đầu tuần (openingBalance)
              </label>
              <div className="relative flex items-center">
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatDigitsWithComma(openingDigits)}
                  onChange={(e) =>
                    setOpeningDigits(e.target.value.replace(/\D/g, ''))
                  }
                  placeholder="0"
                  className="w-full rounded-2xl border border-slate-200 bg-surface-muted pl-4 pr-9 py-2.5 text-base font-bold tabular-nums text-ink-primary focus:border-primary focus:bg-white focus:outline-none"
                />
                <span className="absolute right-3.5 text-xs font-bold text-ink-secondary">
                  đ
                </span>
              </div>
            </div>
          </div>

          {/* 2. Hạn mức tuần cho từng danh mục */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold text-ink-secondary">
              Hạn mức tuần cho từng danh mục (weeklyLimit)
            </label>
            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-surface-muted/70 px-3.5 py-2"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
                      style={{
                        backgroundColor: `${cat.color}18`,
                        color: cat.color,
                      }}
                    >
                      <CategoryIcon iconName={cat.icon} className="h-4 w-4" />
                    </div>
                    <span className="truncate text-xs sm:text-sm font-bold text-ink-primary">
                      {cat.name}
                    </span>
                  </div>

                  <div className="relative flex w-36 shrink-0 items-center">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formatDigitsWithComma(limitMap[cat.id] ?? '')}
                      onChange={(e) =>
                        handleCategoryLimitChange(cat.id, e.target.value)
                      }
                      placeholder="0"
                      className="w-full rounded-xl border border-slate-200 bg-white pl-3 pr-7 py-1.5 text-right text-xs sm:text-sm font-bold tabular-nums text-ink-primary focus:border-primary focus:outline-none"
                    />
                    <span className="absolute right-2.5 text-xs font-bold text-ink-secondary">
                      đ
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 3. Sao lưu, Khôi phục & Nút "Xoá toàn bộ dữ liệu (Làm mới về 0)" */}
          <div className="rounded-2xl border border-slate-200/80 bg-surface-muted/80 p-3.5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-ink-primary">
                Sao lưu & Đồng bộ dữ liệu
              </span>
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold',
                  isCloudEnabled
                    ? 'bg-semantic-safe-light text-semantic-safe-dark'
                    : 'bg-slate-200/80 text-ink-secondary'
                )}
              >
                {isCloudEnabled ? (
                  <>
                    <Cloud className="h-3 w-3" />
                    <span>Supabase Cloud Sync</span>
                  </>
                ) : (
                  <>
                    <HardDrive className="h-3 w-3" />
                    <span>Offline-first (LocalStorage)</span>
                  </>
                )}
              </span>
            </div>

            {backupError && (
              <div className="rounded-xl bg-semantic-danger-light px-3 py-2 text-xs font-semibold text-semantic-danger-dark">
                {backupError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => BackupService.triggerDownloadBackup()}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-ink-primary shadow-sm hover:border-primary hover:text-primary active:scale-95 transition-all"
              >
                <Download className="h-3.5 w-3.5 text-primary" />
                <span>Xuất file JSON</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-ink-primary shadow-sm hover:border-primary hover:text-primary active:scale-95 transition-all"
              >
                <Upload className="h-3.5 w-3.5 text-semantic-safe" />
                <span>Nhập file JSON</span>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                onChange={handleImportFileChange}
                className="hidden"
              />
            </div>

            {/* Nút "Xoá toàn bộ dữ liệu (Làm mới về 0)" */}
            <div className="pt-1 border-t border-slate-200/70">
              {!confirmReset ? (
                <button
                  type="button"
                  onClick={() => setConfirmReset(true)}
                  className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-semantic-danger/30 bg-semantic-danger-light/60 px-3 py-2.5 text-xs font-bold text-semantic-danger-dark hover:bg-semantic-danger-light active:scale-95 transition-all"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Xoá toàn bộ dữ liệu (Làm mới về 0)</span>
                </button>
              ) : (
                <div className="rounded-xl bg-semantic-danger-light p-3 space-y-2.5 border border-semantic-danger/30">
                  <p className="text-[11px] font-semibold text-semantic-danger-dark leading-relaxed">
                    Giữ nguyên danh sách danh mục hiện có, nhưng đưa toàn bộ hạn mức, ngân sách tuần về 0đ và xoá sạch lịch sử giao dịch?
                  </p>
                  <div className="flex items-center gap-2">
                    <PillButton
                      type="button"
                      variant="ghost"
                      size="sm"
                      fullWidth
                      onClick={() => setConfirmReset(false)}
                    >
                      Huỷ
                    </PillButton>
                    <PillButton
                      type="button"
                      variant="danger"
                      size="sm"
                      fullWidth
                      isLoading={isResetting}
                      onClick={() => void handleExecuteResetToZero()}
                    >
                      Xác nhận làm mới về 0
                    </PillButton>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2.5 pt-1">
            <PillButton
              type="button"
              variant="ghost"
              fullWidth
              onClick={onClose}
            >
              Hủy
            </PillButton>
            <PillButton
              type="submit"
              variant="primary"
              fullWidth
              isLoading={isSaving}
              leftIcon={<Sparkles className="h-4 w-4" />}
            >
              Lưu ngân sách
            </PillButton>
          </div>
        </form>
      </SoftCard>
    </div>
  );
};