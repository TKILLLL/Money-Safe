import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface SoftCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Độ rộng khoảng đệm bên trong thẻ */
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** Kích hoạt hiệu ứng nổi lên và phản hồi xúc giác khi nhấn/di chuột */
  interactive?: boolean;
  /** Bo góc 16px-20px (2xl) hoặc 24px (3xl) */
  radius?: '2xl' | '3xl';
  /** Biến thể nền thẻ */
  variant?: 'default' | 'subtle' | 'gradient';
}

export const SoftCard = forwardRef<HTMLDivElement, SoftCardProps>(
  (
    {
      className,
      padding = 'md',
      interactive = false,
      radius = '2xl',
      variant = 'default',
      children,
      ...props
    },
    ref
  ) => {
    const paddingStyles: Record<NonNullable<SoftCardProps['padding']>, string> = {
      none: 'p-0',
      sm: 'p-3.5 sm:p-4',
      md: 'p-5 sm:p-6',
      lg: 'p-6 sm:p-8',
    };

    const radiusStyles: Record<NonNullable<SoftCardProps['radius']>, string> = {
      '2xl': 'rounded-2xl',
      '3xl': 'rounded-3xl',
    };

    const variantStyles: Record<NonNullable<SoftCardProps['variant']>, string> = {
      default: 'bg-surface text-ink-primary border border-slate-100/80 shadow-soft',
      subtle: 'bg-surface-muted text-ink-primary border border-slate-200/50',
      gradient:
        'bg-gradient-to-br from-primary to-primary-accent text-white shadow-soft-primary border-none',
    };

    return (
      <div
        ref={ref}
        className={cn(
          'transition-all duration-300 ease-apple-spring',
          radiusStyles[radius],
          paddingStyles[padding],
          variantStyles[variant],
          interactive &&
            'cursor-pointer hover:-translate-y-0.5 hover:shadow-soft-md active:scale-[0.99]',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

SoftCard.displayName = 'SoftCard';