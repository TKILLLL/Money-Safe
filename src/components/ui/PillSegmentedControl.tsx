'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
  badge?: string | number;
}

export interface PillSegmentedControlProps<T extends string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
  fullWidth?: boolean;
  className?: string;
  ariaLabel?: string;
}

export function PillSegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  fullWidth = false,
  className,
  ariaLabel = 'Segmented Control',
}: PillSegmentedControlProps<T>): React.ReactElement {
  const sizeStyles = {
    sm: 'p-1 text-xs',
    md: 'p-1.5 text-sm',
  };

  const itemPaddingStyles = {
    sm: 'px-3 py-1.5',
    md: 'px-4 py-2',
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex items-center rounded-full bg-slate-200/70 backdrop-blur-md shadow-inner-soft',
        sizeStyles[size],
        fullWidth && 'w-full flex',
        className
      )}
    >
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(option.value)}
            className={cn(
              'relative inline-flex items-center justify-center gap-2 rounded-full font-semibold select-none',
              'transition-all duration-250 ease-apple-spring',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
              itemPaddingStyles[size],
              fullWidth && 'flex-1',
              isActive
                ? 'bg-surface text-primary shadow-soft scale-[1.01]'
                : 'text-ink-secondary hover:text-ink-primary active:scale-[0.98]'
            )}
          >
            {option.icon && <span className="shrink-0">{option.icon}</span>}
            <span className="truncate">{option.label}</span>
            {option.badge !== undefined && (
              <span
                className={cn(
                  'ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none',
                  isActive
                    ? 'bg-primary-100 text-primary-700'
                    : 'bg-slate-300/70 text-ink-secondary'
                )}
              >
                {option.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}