// src/components/screens/CategoryManagerModal.tsx
'use client';

import React, { useEffect, useState } from 'react';
import {
  Archive,
  Check,
  Edit3,
  Plus,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react';
import { useExpenseTracker } from '@/components/providers/ExpenseTrackerProvider';
import {
  AVAILABLE_CATEGORY_ICONS,
  CATEGORY_COLOR_PALETTE,
  CategoryIcon,
} from '@/components/ui/CategoryIcon';
import { PillButton } from '@/components/ui/PillButton';
import { SoftCard } from '@/components/ui/SoftCard';
import type { Category, CategoryType } from '@/core/domain/entities/Category';
import { cn } from '@/lib/utils';

export interface CategoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultType?: CategoryType;
  onSelectCategory?: (categoryId: string) => void;
}

export const CategoryManagerModal: React.FC<CategoryManagerModalProps> = ({
  isOpen,
  onClose,
  defaultType = 'EXPENSE',
  onSelectCategory,
}) => {
  const {
    allCategoriesIncludingArchived,
    saveCategory,
    archiveCategory,
    restoreCategory,
  } = useExpenseTracker();

  const [mode, setMode] = useState<'list' | 'form'>('list');
  const [filterType, setFilterType] = useState<'OUTFLOW' | 'INCOME'>(
    defaultType === 'INCOME' ? 'INCOME' : 'OUTFLOW'
  );

  // Form State
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [name, setName] = useState<string>('');
  const [icon, setIcon] = useState<string>('Utensils');
  const [color, setColor] = useState<string>('#8B5CF6');
  const [categoryType, setCategoryType] = useState<CategoryType>(defaultType);
  const [weeklyLimitDigits, setWeeklyLimitDigits] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setMode('list');
      setFilterType(defaultType === 'INCOME' ? 'INCOME' : 'OUTFLOW');
      setFormError(null);
    }
  }, [isOpen, defaultType]);

  if (!isOpen) return null;

  const filteredCategories = allCategoriesIncludingArchived.filter((cat) => {
    if (filterType === 'INCOME') return cat.type === 'INCOME';
    return cat.type === 'EXPENSE' || cat.type === 'SAVING';
  });

  const activeList = filteredCategories.filter((c) => !c.isArchived);
  const archivedList = filteredCategories.filter((c) => c.isArchived);

  const openCreateForm = () => {
    setEditingId(undefined);
    setName('');
    setIcon(filterType === 'INCOME' ? 'Wallet' : 'Utensils');
    setColor(filterType === 'INCOME' ? '#10B981' : '#8B5CF6');
    setCategoryType(filterType === 'INCOME' ? 'INCOME' : 'EXPENSE');
    setWeeklyLimitDigits('');
    setFormError(null);
    setMode('form');
  };

  const openEditForm = (cat: Category) => {
    setEditingId(cat.id);
    setName(cat.name);
    setIcon(cat.icon);
    setColor(cat.color);
    setCategoryType(cat.type);
    setWeeklyLimitDigits(
      cat.weeklyLimit.amount > 0 ? String(cat.weeklyLimit.amount) : ''
    );
    setFormError(null);
    setMode('form');
  };

  const formattedLimitDisplay = weeklyLimitDigits
    ? Number(weeklyLimitDigits).toLocaleString('en-US')
    : '';

  const handleLimitInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawDigits = e.target.value.replace(/\D/g, '');
    setWeeklyLimitDigits(rawDigits);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('Vui lòng nhập tên danh mục.');
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError(null);
      const limitAmount = weeklyLimitDigits ? parseInt(weeklyLimitDigits, 10) : 0;

      const saved = await saveCategory({
        id: editingId,
        name: name.trim(),
        icon,
        color,
        type: categoryType,
        weeklyLimit: limitAmount,
      });

      if (onSelectCategory) {
        onSelectCategory(saved.id);
      }
      setMode('list');
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Không thể lưu danh mục.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="category-modal-title"
    >
      <SoftCard
        padding="none"
        radius="3xl"
        className="w-full max-w-lg max-h-[88dvh] flex flex-col overflow-hidden rounded-b-none sm:rounded-3xl shadow-soft-md border border-slate-200/80"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 bg-surface">
          <div>
            <h3
              id="category-modal-title"
              className="text-base sm:text-lg font-bold text-ink-primary"
            >
              {mode === 'list'
                ? 'Quản lý Danh mục'
                : editingId
                  ? 'Chỉnh sửa Danh mục'
                  : 'Thêm Danh mục mới'}
            </h3>
            <p className="text-xs text-ink-secondary">
              {mode === 'list'
                ? 'Tùy chỉnh tên, biểu tượng, màu sắc và hạn mức tuần'
                : 'Điền thông tin chi tiết cho danh mục của bạn'}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-ink-secondary hover:bg-slate-200 hover:text-ink-primary transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {mode === 'list' ? (
            <>
              {/* Filter Pill & Create Button */}
              <div className="flex items-center justify-between gap-2">
                <div className="inline-flex rounded-full bg-slate-100 p-1">
                  <button
                    type="button"
                    onClick={() => setFilterType('OUTFLOW')}
                    className={cn(
                      'rounded-full px-3.5 py-1.5 text-xs font-bold transition-all',
                      filterType === 'OUTFLOW'
                        ? 'bg-primary text-white shadow-sm'
                        : 'text-ink-secondary hover:text-ink-primary'
                    )}
                  >
                    Chi tiêu & Tiết kiệm
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterType('INCOME')}
                    className={cn(
                      'rounded-full px-3.5 py-1.5 text-xs font-bold transition-all',
                      filterType === 'INCOME'
                        ? 'bg-primary text-white shadow-sm'
                        : 'text-ink-secondary hover:text-ink-primary'
                    )}
                  >
                    Tiền thu
                  </button>
                </div>

                <PillButton
                  variant="primary"
                  size="sm"
                  leftIcon={<Plus className="h-3.5 w-3.5" />}
                  onClick={openCreateForm}
                >
                  Thêm mới
                </PillButton>
              </div>

              {/* Active Categories List */}
              <div className="space-y-2.5">
                {activeList.length === 0 ? (
                  <div className="rounded-2xl bg-surface-muted p-6 text-center text-xs text-ink-secondary">
                    Chưa có danh mục nào trong nhóm này. Hãy bấm &ldquo;Thêm mới&rdquo; để khởi tạo!
                  </div>
                ) : (
                  activeList.map((cat) => (
                    <div
                      key={cat.id}
                      className="flex items-center justify-between rounded-2xl border border-slate-100 bg-surface-muted/70 p-3 hover:border-primary/30 transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
                          style={{ backgroundColor: cat.color }}
                        >
                          <CategoryIcon iconName={cat.icon} className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="truncate text-sm font-bold text-ink-primary">
                              {cat.name}
                            </p>
                            {cat.type === 'SAVING' && (
                              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                                Tiết kiệm
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-ink-secondary">
                            Hạn mức tuần:{' '}
                            <span className="font-semibold text-ink-primary">
                              {cat.weeklyLimit.isPositive()
                                ? cat.weeklyLimit.formatVND()
                                : 'Không giới hạn'}
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => openEditForm(cat)}
                          title="Chỉnh sửa danh mục"
                          className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-ink-secondary shadow-sm hover:text-primary border border-slate-200/70 transition-colors"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void archiveCategory(cat.id)}
                          title="Ẩn / Lưu trữ danh mục"
                          className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-ink-secondary shadow-sm hover:text-semantic-danger border border-slate-200/70 transition-colors"
                        >
                          <Archive className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Archived Categories List */}
              {archivedList.length > 0 && (
                <div className="pt-2 space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                    Danh mục đã ẩn ({archivedList.length})
                  </p>
                  {archivedList.map((cat) => (
                    <div
                      key={cat.id}
                      className="flex items-center justify-between rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-2.5 opacity-75"
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-white"
                          style={{ backgroundColor: cat.color }}
                        >
                          <CategoryIcon iconName={cat.icon} className="h-4 w-4" />
                        </div>
                        <span className="text-xs font-semibold text-ink-secondary line-through">
                          {cat.name}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => void restoreCategory(cat.id)}
                        className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-primary shadow-sm border border-slate-200"
                      >
                        <RotateCcw className="h-3 w-3" />
                        <span>Khôi phục</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            /* Create / Edit Category Form */
            <form onSubmit={(e) => void handleSubmitForm(e)} className="space-y-4">
              {formError && (
                <div className="rounded-xl bg-semantic-danger-light px-3.5 py-2.5 text-xs font-semibold text-semantic-danger-dark">
                  {formError}
                </div>
              )}

              {/* Tên danh mục */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-ink-secondary">
                  Tên danh mục
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="VD: Trà sữa, Tiền nhà, Học bổng..."
                  maxLength={40}
                  className="w-full rounded-2xl border border-slate-200 bg-surface-muted px-4 py-3 text-sm font-semibold text-ink-primary focus:border-primary focus:bg-white focus:outline-none"
                />
              </div>

              {/* Loại danh mục (Khi tạo mới) */}
              {!editingId && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-ink-secondary">
                    Nhóm danh mục
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        { value: 'EXPENSE', label: 'Chi tiêu' },
                        { value: 'SAVING', label: 'Tiết kiệm' },
                        { value: 'INCOME', label: 'Thu nhập' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setCategoryType(opt.value)}
                        className={cn(
                          'rounded-xl py-2.5 text-xs font-bold border transition-all',
                          categoryType === opt.value
                            ? 'border-primary bg-primary-50 text-primary'
                            : 'border-slate-200 bg-surface text-ink-secondary'
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Hạn mức chi tiêu tuần */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-ink-secondary">
                  Hạn mức tuần (Để trống hoặc 0 nếu không giới hạn)
                </label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formattedLimitDisplay}
                    onChange={handleLimitInputChange}
                    placeholder="0"
                    className="w-full rounded-2xl border border-slate-200 bg-surface-muted pl-4 pr-10 py-3 text-base font-bold tabular-nums text-ink-primary focus:border-primary focus:bg-white focus:outline-none"
                  />
                  <span className="
                    absolute right-4 text-sm font-bold text-ink-secondary
                  ">
                    đ
                  </span>
                </div>
              </div>

              {/* Chọn màu sắc */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-ink-secondary">
                  Màu sắc nhận diện
                </label>
                <div className="flex flex-wrap gap-2.5 pt-1">
                  {CATEGORY_COLOR_PALETTE.map((hex) => {
                    const isSelected = color.toUpperCase() === hex.toUpperCase();
                    return (
                      <button
                        key={hex}
                        type="button"
                        onClick={() => setColor(hex)}
                        className={cn(
                          'flex h-8 w-8 items-center justify-center rounded-full transition-transform',
                          isSelected && 'scale-110 ring-2 ring-offset-2 ring-primary'
                        )}
                        style={{ backgroundColor: hex }}
                        aria-label={`Chọn màu ${hex}`}
                      >
                        {isSelected && <Check className="h-4 w-4 text-white" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Chọn biểu tượng (Lucide Icon) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-ink-secondary">
                  Biểu tượng
                </label>
                <div className="grid grid-cols-5 sm:grid-cols-6 gap-2 max-h-40 overflow-y-auto p-1">
                  {AVAILABLE_CATEGORY_ICONS.map((item) => {
                    const isSelected = icon === item.name;
                    return (
                      <button
                        key={item.name}
                        type="button"
                        onClick={() => setIcon(item.name)}
                        title={item.label}
                        className={cn(
                          'flex flex-col items-center justify-center gap-1 rounded-xl p-2.5 border transition-all',
                          isSelected
                            ? 'border-primary bg-primary-50 text-primary shadow-sm'
                            : 'border-slate-100 bg-surface-muted text-ink-secondary hover:text-ink-primary'
                        )}
                      >
                        <CategoryIcon iconName={item.name} className="h-5 w-5" />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Form Footer Actions */}
              <div className="flex items-center gap-2.5 pt-2">
                <PillButton
                  type="button"
                  variant="ghost"
                  fullWidth
                  onClick={() => setMode('list')}
                >
                  Quay lại
                </PillButton>
                <PillButton
                  type="submit"
                  variant="primary"
                  fullWidth
                  isLoading={isSubmitting}
                  leftIcon={<Sparkles className="h-4 w-4" />}
                >
                  {editingId ? 'Lưu thay đổi' : 'Tạo danh mục'}
                </PillButton>
              </div>
            </form>
          )}
        </div>
      </SoftCard>
    </div>
  );
};