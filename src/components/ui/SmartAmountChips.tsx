// src/components/ui/SmartAmountChips.tsx
'use client';

import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';

const MIN_SUGGESTION_VND = 1_000;
const MAX_SUGGESTION_VND = 100_000_000;
const MAX_CHIP_COUNT = 4;

/**
 * Thuật toán gợi ý mệnh giá thông minh kiểu MB Bank cho VND:
 * - Khi nhập 1-2 chữ số (1..99): ưu tiên từ hàng nghìn trở lên (x1,000 -> x1,000,000)
 *   VD: 1 -> 1,000 | 10,000 | 100,000 | 1,000,000
 *   VD: 10 -> 10,000 | 100,000 | 1,000,000 | 10,000,000
 *   VD: 37 -> 37,000 | 370,000 | 3,700,000 | 37,000,000
 * - Khi nhập từ 3 chữ số trở lên (>= 100): nhân với [10, 100, 1,000, 10,000, 100,000]
 *   VD: 370 -> 3,700 | 37,000 | 370,000 | 3,700,000
 */
export function generateSmartAmountSuggestions(rawAmount: number): number[] {
  if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
    return [];
  }

  const normalized = Math.floor(rawAmount);
  if (normalized >= MAX_SUGGESTION_VND) {
    return [];
  }

  const multipliers =
    normalized < 100
      ? [1_000, 10_000, 100_000, 1_000_000]
      : [10, 100, 1_000, 10_000, 100_000];

  const uniqueSuggestions = new Set<number>();

  for (const factor of multipliers) {
    const candidate = normalized * factor;
    if (
      candidate >= MIN_SUGGESTION_VND &&
      candidate <= MAX_SUGGESTION_VND &&
      candidate !== normalized
    ) {
      uniqueSuggestions.add(candidate);
    }
    if (uniqueSuggestions.size >= MAX_CHIP_COUNT) {
      break;
    }
  }

  return Array.from(uniqueSuggestions);
}

export function formatChipVND(amount: number): string {
  return `${Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',')}đ`;
}

export interface SmartAmountChipsProps {
  /** Số nguyên đang nhập trong ô input (VD: 1, 10, 37, 370) */
  rawAmount: number;
  /** Cờ ẩn thanh gợi ý sau khi người dùng đã bấm chọn 1 chip */
  isDismissed?: boolean;
  /** Callback khi người dùng bấm chọn 1 mệnh giá gợi ý */
  onSelectAmount: (selectedValue: number) => void;
  className?: string;
}

export const SmartAmountChips: React.FC<SmartAmountChipsProps> = ({
  rawAmount,
  isDismissed = false,
  onSelectAmount,
  className,
}) => {
  const suggestions = useMemo(() => {
    if (isDismissed || rawAmount <= 0) {
      return [];
    }
    return generateSmartAmountSuggestions(rawAmount);
  }, [rawAmount, isDismissed]);

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div
      role="group"
      aria-label="Gợi ý mệnh giá thông minh"
      className={cn(
        'flex items-center gap-2 overflow-x-auto no-scrollbar py-1.5',
        className
      )}
    >
      {suggestions.map((value) => (
        <button
          key={value}
          type="button"
          onMouseDown={(e) => {
            // Giữ focus cho ô input trên iPhone, tránh bàn phím bị thu xuống gây giật lag
            e.preventDefault();
          }}
          onClick={() => onSelectAmount(value)}
          className={cn(
            'shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold tabular-nums select-none',
            'bg-purple-50 text-purple-700 border border-purple-200/70',
            'hover:bg-purple-600 hover:text-white active:scale-95 transition-all'
          )}
        >
          {formatChipVND(value)}
        </button>
      ))}
    </div>
  );
};