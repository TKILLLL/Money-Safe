// src/components/screens/QuickEntryScreen.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronRight as ChevronRightSmall,
  Settings2,
  Sparkles,
} from 'lucide-react';
import { useExpenseTracker } from '@/components/providers/ExpenseTrackerProvider';
import { CategoryManagerModal } from '@/components/screens/CategoryManagerModal';
import { CategoryIcon } from '@/components/ui/CategoryIcon';
import { PillButton } from '@/components/ui/PillButton';
import { SoftCard } from '@/components/ui/SoftCard';
import { cn } from '@/lib/utils';

type EntryTabMode = 'EXPENSE_MODE' | 'INCOME_MODE';

const QUICK_AMOUNT_CHIPS: readonly number[] = [15_000, 30_000, 35_000, 50_000, 100_000];

/**
 * Định dạng ngày chuẩn DD/MM/YYYY (Th X) theo yêu cầu
 */
function formatVietnameseEntryDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  const dayOfWeek = date.getDay(); // 0: CN, 1: Th 2 ... 6: Th 7
  const weekdayLabel = dayOfWeek === 0 ? 'CN' : `Th ${dayOfWeek + 1}`;

  return `${day}/${month}/${year} (${weekdayLabel})`;
}

export const QuickEntryScreen: React.FC = () => {
  const {
    selectedDate,
    setSelectedDate,
    analytics,
    categories,
    addTransaction,
    saveCategory,
  } = useExpenseTracker();

  // 1. Header Segmented Control state ('EXPENSE_MODE' = Tiền chi, 'INCOME_MODE' = Tiền thu)
  const [entryMode, setEntryMode] = useState<EntryTabMode>('EXPENSE_MODE');

  // 2. Form Nhập liệu state
  const [note, setNote] = useState<string>('');
  const [amountDigits, setAmountDigits] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');

  // 3. UI & Modal state
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [seededDefaultIncome, setSeededDefaultIncome] = useState<boolean>(false);

  // Tự động khởi tạo 3 danh mục Tiền thu mẫu cho sinh viên nếu chuyển sang tab "Tiền thu" lần đầu
  useEffect(() => {
    if (entryMode !== 'INCOME_MODE' || seededDefaultIncome) return;

    const existingIncomeCategories = categories.filter((c) => c.type === 'INCOME');
    if (existingIncomeCategories.length === 0) {
      setSeededDefaultIncome(true);
      void (async () => {
        await saveCategory({
          id: 'cat_income_allowance',
          name: 'Gia đình gửi thêm',
          icon: 'Wallet',
          color: '#10B981',
          type: 'INCOME',
          weeklyLimit: 0,
        });
        await saveCategory({
          id: 'cat_income_parttime',
          name: 'Lương Part-time',
          icon: 'TrendingUp',
          color: '#8B5CF6',
          type: 'INCOME',
          weeklyLimit: 0,
        });
        await saveCategory({
          id: 'cat_income_scholarship',
          name: 'Học bổng & Thưởng',
          icon: 'GraduationCap',
          color: '#0EA5E9',
          type: 'INCOME',
          weeklyLimit: 0,
        });
      })();
    }
  }, [entryMode, categories, saveCategory, seededDefaultIncome]);

  // Lọc danh mục theo tab "Tiền chi" (gồm EXPENSE & SAVING) hoặc "Tiền thu" (INCOME)
  const displayedCategories = useMemo(() => {
    if (entryMode === 'INCOME_MODE') {
      return categories.filter((c) => c.type === 'INCOME');
    }
    return categories.filter((c) => c.type === 'EXPENSE' || c.type === 'SAVING');
  }, [categories, entryMode]);

  // Tự động chọn danh mục đầu tiên khi chuyển tab hoặc khi danh sách thay đổi
  useEffect(() => {
    if (displayedCategories.length === 0) {
      setSelectedCategoryId('');
      return;
    }
    const stillValid = displayedCategories.some(
      (c) => c.id === selectedCategoryId
    );
    if (!stillValid) {
      setSelectedCategoryId(displayedCategories[0].id);
    }
  }, [displayedCategories, selectedCategoryId]);

  // Tự động ẩn thông báo thành công sau 2.8 giây
  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 2800);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  // Điều hướng lùi / tiến 1 ngày
  const handleStepDay = (offsetDays: number) => {
    const nextDate = new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate() + offsetDays,
      12,
      0,
      0,
      0
    );
    setSelectedDate(nextDate);
  };

  // Xử lý gõ số tiền & tự động format dấu phẩy hàng nghìn
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalError(null);
    const digitsOnly = e.target.value.replace(/\D/g, '');
    // Giới hạn tối đa 10 chữ số để tránh tràn số
    if (digitsOnly.length <= 10) {
      setAmountDigits(digitsOnly.replace(/^0+/, ''));
    }
  };

  const numericAmount = amountDigits ? parseInt(amountDigits, 10) : 0;
  const formattedAmountInput =
    numericAmount > 0
      ? numericAmount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
      : '';

  // Xử lý lưu giao dịch khi bấm Primary CTA Button
  const handleSubmitTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (numericAmount <= 0) {
      setLocalError('Vui lòng nhập số tiền lớn hơn 0đ.');
      return;
    }

    const chosenCategory = displayedCategories.find(
      (c) => c.id === selectedCategoryId
    );
    if (!chosenCategory) {
      setLocalError('Vui lòng chọn một danh mục bên dưới.');
      return;
    }

    try {
      setIsSubmitting(true);

      // Giữ giờ hiện tại trên ngày đang chọn
      const now = new Date();
      const txTimestamp = new Date(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        selectedDate.getDate(),
        now.getHours(),
        now.getMinutes(),
        now.getSeconds()
      );

      const createdTx = await addTransaction({
        amount: numericAmount,
        categoryId: chosenCategory.id,
        type: chosenCategory.type,
        timestamp: txTimestamp,
        note: note.trim(),
      });

      // Reset ô tiền về 0 & xóa ghi chú
      setAmountDigits('');
      setNote('');

      // Hiển thị thông báo thành công nhẹ nhàng
      setToastMessage(
        `Đã lưu ${chosenCategory.name}: ${createdTx.amount.formatVND()}`
      );
    } catch (err) {
      setLocalError(
        err instanceof Error ? err.message : 'Không thể lưu giao dịch.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const dailySafe = analytics?.dailySafeToSpend;
  const usagePct = dailySafe?.todayUsagePercentage ?? 0;
  const clampedBarWidth = Math.min(Math.max(usagePct, 0), 100);

  // Màu thanh Progress Bar theo đúng đặc tả:
  // Tím/Xanh khi < 75%, Cam (#F97316) khi 75% - 99%, Đỏ (#EF4444) khi >= 100%
  const progressColorClass =
    usagePct >= 100
      ? 'bg-semantic-danger'
      : usagePct >= 75
        ? 'bg-semantic-warning'
        : 'bg-gradient-to-r from-primary to-semantic-safe';

  const progressTextColorClass =
    usagePct >= 100
      ? 'text-semantic-danger'
      : usagePct >= 75
        ? 'text-semantic-warning'
        : 'text-primary';

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* 1. HEADER SEGMENTED CONTROL: Tiền chi | Tiền thu */}
      <div className="flex justify-center">
        <div
          role="tablist"
          aria-label="Chế độ nhập giao dịch"
          className="inline-flex w-full max-w-xs items-center rounded-full bg-surface p-1.5 shadow-soft border border-slate-100"
        >
          <button
            type="button"
            role="tab"
            aria-selected={entryMode === 'EXPENSE_MODE'}
            onClick={() => {
              setEntryMode('EXPENSE_MODE');
              setLocalError(null);
            }}
            className={cn(
              'flex-1 rounded-full py-2.5 text-sm font-bold transition-all duration-200 ease-apple-spring select-none',
              entryMode === 'EXPENSE_MODE'
                ? 'bg-[#8B5CF6] text-white shadow-soft-primary scale-[1.01]'
                : 'text-ink-secondary hover:text-ink-primary'
            )}
          >
            Tiền chi
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={entryMode === 'INCOME_MODE'}
            onClick={() => {
              setEntryMode('INCOME_MODE');
              setLocalError(null);
            }}
            className={cn(
              'flex-1 rounded-full py-2.5 text-sm font-bold transition-all duration-200 ease-apple-spring select-none',
              entryMode === 'INCOME_MODE'
                ? 'bg-[#8B5CF6] text-white shadow-soft-primary scale-[1.01]'
                : 'text-ink-secondary hover:text-ink-primary'
            )}
          >
            Tiền thu
          </button>
        </div>
      </div>

      {/* 2. WIDGET "ĐƯỢC TIÊU HÔM NAY" (Daily Safe-to-Spend Card) */}
      {dailySafe && (
        <SoftCard padding="md" radius="2xl" className="space-y-3">
          {/* Hàng 1: Tiêu đề đậm bên trái | Còn lại bên phải (đổi sang màu đỏ nếu âm) */}
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm sm:text-base font-bold text-ink-primary">
              Được tiêu hôm nay
            </h2>
            <span
              className={cn(
                'text-sm sm:text-base font-bold tabular-nums',
                dailySafe.todayRemaining.isNegative()
                  ? 'text-semantic-danger'
                  : 'text-ink-primary'
              )}
            >
              Còn lại: {dailySafe.todayRemaining.formatVND()}
            </span>
          </div>

          {/* Hàng 2: Thanh Progress Bar bo tròn + Con số [TodayUsagePercentage]% bên phải */}
          <div className="flex items-center gap-3">
            <div
              role="progressbar"
              aria-valuenow={usagePct}
              aria-valuemin={0}
              aria-valuemax={100}
              className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100 shadow-inner-soft"
            >
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500 ease-apple-spring',
                  progressColorClass
                )}
                style={{ width: `${clampedBarWidth}%` }}
              />
            </div>

            <span
              className={cn(
                'w-11 text-right text-xs sm:text-sm font-bold tabular-nums shrink-0',
                progressTextColorClass
              )}
            >
              {usagePct}%
            </span>
          </div>

          {/* Hàng 3: Chữ nhỏ màu xám (Định mức ngày | Đã chi hôm nay) */}
          <div className="flex items-center justify-between text-xs text-ink-secondary">
            <span>
              Định mức ngày:{' '}
              <strong className="font-semibold text-ink-primary tabular-nums">
                {dailySafe.dailyAllowance.formatVND()}
              </strong>
            </span>
            <span>
              Đã chi hôm nay:{' '}
              <strong className="font-semibold text-ink-primary tabular-nums">
                {dailySafe.todaySpent.formatVND()}
              </strong>
            </span>
          </div>
        </SoftCard>
      )}

      {/* Thông báo Toast khi lưu giao dịch thành công */}
      {toastMessage && (
        <div className="flex items-center gap-2 rounded-2xl bg-semantic-safe-light/90 px-4 py-3 text-xs sm:text-sm font-bold text-semantic-safe-dark border border-semantic-safe/25 shadow-soft animate-in fade-in slide-in-from-top-2 duration-200">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-semantic-safe" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Thông báo lỗi nhập liệu (nếu có) */}
      {localError && (
        <div className="rounded-2xl bg-semantic-danger-light px-4 py-2.5 text-xs font-semibold text-semantic-danger-dark border border-semantic-danger/20">
          {localError}
        </div>
      )}

      {/* 3. FORM NHẬP LIỆU NHANH */}
      <form onSubmit={(e) => void handleSubmitTransaction(e)} className="space-y-4">
        <SoftCard padding="none" radius="2xl" className="divide-y divide-slate-100 overflow-hidden">
          {/* Hàng 1: NGÀY (DD/MM/YYYY (Th X) kèm 2 nút < >) */}
          <div className="flex items-center justify-between px-4 sm:px-5 py-3.5">
            <span className="text-xs sm:text-sm font-bold text-ink-secondary w-24 shrink-0">
              Ngày
            </span>

            <div className="flex flex-1 items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => handleStepDay(-1)}
                aria-label="Lùi 1 ngày"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-ink-secondary hover:bg-primary-50 hover:text-primary active:scale-90 transition-all"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <div className="min-w-[155px] rounded-xl bg-surface-muted px-3 py-1.5 text-center border border-slate-200/60">
                <span className="text-xs sm:text-sm font-bold tabular-nums text-ink-primary">
                  {formatVietnameseEntryDate(selectedDate)}
                </span>
              </div>

              <button
                type="button"
                onClick={() => handleStepDay(1)}
                aria-label="Tiến 1 ngày"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-ink-secondary hover:bg-primary-50 hover:text-primary active:scale-90 transition-all"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Hàng 2: GHI CHÚ (Placeholder "Chưa nhập vào") */}
          <div className="flex items-center justify-between px-4 sm:px-5 py-3.5">
            <label
              htmlFor="tx-note-input"
              className="text-xs sm:text-sm font-bold text-ink-secondary w-24 shrink-0"
            >
              Ghi chú
            </label>
            <input
              id="tx-note-input"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Chưa nhập vào"
              maxLength={120}
              className="w-full bg-transparent text-right text-sm font-medium text-ink-primary placeholder:text-ink-muted focus:outline-none"
            />
          </div>

          {/* Hàng 3: TIỀN CHI / TIỀN THU (text-2xl font-bold, tự động format dấu phẩy, có đ bên phải) */}
          <div className="px-4 sm:px-5 py-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <label
                htmlFor="tx-amount-input"
                className="text-xs sm:text-sm font-bold text-ink-secondary w-24 shrink-0"
              >
                {entryMode === 'EXPENSE_MODE' ? 'Tiền chi' : 'Tiền thu'}
              </label>

              <div className="flex flex-1 items-baseline justify-end gap-1.5">
                <input
                  id="tx-amount-input"
                  type="text"
                  inputMode="numeric"
                  value={formattedAmountInput}
                  onChange={handleAmountChange}
                  placeholder="0"
                  className={cn(
                    'w-full bg-transparent text-right text-2xl font-bold tabular-nums tracking-tight focus:outline-none',
                    entryMode === 'EXPENSE_MODE'
                      ? 'text-ink-primary placeholder:text-slate-300'
                      : 'text-semantic-safe placeholder:text-slate-300'
                  )}
                />
                <span className="text-lg font-bold text-ink-secondary shrink-0">
                  đ
                </span>
              </div>
            </div>

            {/* Gợi ý mệnh giá nhanh cho sinh viên */}
            <div className="flex items-center justify-end gap-1.5 flex-wrap pt-0.5">
              {QUICK_AMOUNT_CHIPS.map((chipValue) => (
                <button
                  key={chipValue}
                  type="button"
                  onClick={() => setAmountDigits(String(chipValue))}
                  className="rounded-full bg-slate-100/90 hover:bg-primary-50 hover:text-primary px-2.5 py-1 text-[11px] font-semibold tabular-nums text-ink-secondary transition-colors active:scale-95"
                >
                  {chipValue.toLocaleString('en-US')}đ
                </button>
              ))}
              {numericAmount > 0 && numericAmount < 10_000 && (
                <button
                  type="button"
                  onClick={() => setAmountDigits(`${amountDigits}000`)}
                  className="rounded-full bg-primary-50 px-2.5 py-1 text-[11px] font-bold text-primary transition-colors active:scale-95"
                >
                  +000
                </button>
              )}
            </div>
          </div>
        </SoftCard>

        {/* 4. LƯỚI DANH MỤC (CATEGORY GRID 3x3) & NÚT "CHỈNH SỬA >" */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold uppercase tracking-wider text-ink-secondary">
              Danh mục {entryMode === 'EXPENSE_MODE' ? 'chi tiêu' : 'thu nhập'}
            </span>
            <button
              type="button"
              onClick={() => setIsCategoryModalOpen(true)}
              className="text-xs font-bold text-primary hover:underline"
            >
              Tùy chỉnh danh mục
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
            {displayedCategories.map((cat) => {
              const isSelected = cat.id === selectedCategoryId;

              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className={cn(
                    'group relative flex flex-col items-center justify-center gap-2 rounded-2xl p-3.5 sm:p-4 text-center select-none',
                    'transition-all duration-200 ease-apple-spring active:scale-[0.97]',
                    isSelected
                      ? 'bg-primary-50/90 border-2 border-[#8B5CF6] shadow-soft ring-2 ring-[#8B5CF6]/15'
                      : 'bg-surface border border-slate-100 shadow-soft hover:border-slate-200'
                  )}
                >
                  <div
                    className={cn(
                      'flex h-11 w-11 items-center justify-center rounded-2xl transition-transform duration-200',
                      isSelected && 'scale-105'
                    )}
                    style={{
                      backgroundColor: `${cat.color}18`,
                      color: cat.color,
                    }}
                  >
                    <CategoryIcon iconName={cat.icon} className="h-5 w-5" />
                  </div>

                  <span
                    className={cn(
                      'w-full truncate text-xs leading-tight',
                      isSelected
                        ? 'font-bold text-[#8B5CF6]'
                        : 'font-semibold text-ink-primary'
                    )}
                  >
                    {cat.name}
                  </span>
                </button>
              );
            })}

            {/* Ô cuối cùng trong lưới luôn là nút "Chỉnh sửa >" */}
            <button
              type="button"
              onClick={() => setIsCategoryModalOpen(true)}
              className={cn(
                'flex flex-col items-center justify-center gap-2 rounded-2xl p-3.5 sm:p-4 text-center select-none',
                'bg-surface-muted/90 border border-dashed border-slate-300 text-ink-secondary',
                'hover:border-primary hover:bg-primary-50/40 hover:text-primary',
                'transition-all duration-200 ease-apple-spring active:scale-[0.97]'
              )}
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-ink-secondary shadow-sm group-hover:text-primary">
                <Settings2 className="h-5 w-5" />
              </div>
              <span className="inline-flex items-center gap-0.5 text-xs font-bold">
                <span>Chỉnh sửa</span>
                <ChevronRightSmall className="h-3.5 w-3.5" />
              </span>
            </button>
          </div>
        </div>

        {/* 5. PRIMARY CTA BUTTON: "Nhập khoản chi" / "Nhập khoản thu" */}
        <div className="pt-2">
          <PillButton
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            isLoading={isSubmitting}
            leftIcon={<Sparkles className="h-5 w-5" />}
            className="text-base font-bold shadow-soft-primary"
          >
            {entryMode === 'EXPENSE_MODE' ? 'Nhập khoản chi' : 'Nhập khoản thu'}
          </PillButton>
        </div>
      </form>

      {/* Modal Chỉnh sửa / Thêm / Ẩn Danh mục */}
      <CategoryManagerModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        defaultType={entryMode === 'INCOME_MODE' ? 'INCOME' : 'EXPENSE'}
        onSelectCategory={(newCatId) => setSelectedCategoryId(newCatId)}
      />
    </div>
  );
};