import React from 'react';
import { cn } from '@/lib/utils';

export type ProgressTone = 'auto' | 'primary' | 'safe' | 'warning' | 'danger';

export interface ProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Giá trị hiện tại */
  value: number;
  /** Giá trị tối đa (mặc định 100) */
  max?: number;
  /** Chế độ màu: 'auto' tự động chuyển màu theo ngưỡng chi tiêu */
  tone?: ProgressTone;
  /** Độ dày của thanh tiến độ */
  size?: 'sm' | 'md' | 'lg';
  /** Hiển thị nhãn phần trăm và tiêu đề */
  showLabel?: boolean;
  /** Nhãn mô tả bên trái */
  label?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  tone = 'auto',
  size = 'md',
  showLabel = false,
  label,
  className,
  ...props
}) => {
  const safeMax = max > 0 ? max : 100;
  const rawRatio = (value / safeMax) * 100;
  const clampedPercentage = Math.min(Math.max(rawRatio, 0), 100);

  const resolveTone = (): Exclude<ProgressTone, 'auto'> => {
    if (tone !== 'auto') return tone;
    if (rawRatio >= 100) return 'danger';
    if (rawRatio >= 75) return 'warning';
    return 'safe';
  };

  const activeTone = resolveTone();

  const barColorStyles: Record<Exclude<ProgressTone, 'auto'>, string> = {
    primary: 'bg-gradient-to-r from-primary to-primary-accent',
    safe: 'bg-semantic-safe',
    warning: 'bg-semantic-warning',
    danger: 'bg-semantic-danger',
  };

  const trackHeightStyles: Record<NonNullable<ProgressBarProps['size']>, string> = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-4',
  };

  return (
    <div className={cn('w-full space-y-1.5', className)} {...props}>
      {(showLabel || label) && (
        <div className="flex items-center justify-between text-xs font-medium">
          {label && <span className="text-ink-secondary">{label}</span>}
          {showLabel && (
            <span
              className={cn(
                'font-semibold tabular-nums',
                activeTone === 'danger' && 'text-semantic-danger',
                activeTone === 'warning' && 'text-semantic-warning',
                activeTone === 'safe' && 'text-semantic-safe',
                activeTone === 'primary' && 'text-primary'
              )}
            >
              {Math.round(rawRatio)}%
            </span>
          )}
        </div>
      )}

      <div
        role="progressbar"
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={safeMax}
        className={cn(
          'w-full overflow-hidden rounded-full bg-slate-200/75 shadow-inner-soft',
          trackHeightStyles[size]
        )}
      >
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500 ease-apple-spring',
            barColorStyles[activeTone]
          )}
          style={{ width: `${clampedPercentage}%` }}
        />
      </div>
    </div>
  );
};