import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface PillButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'safe' | 'warning' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  isLoading?: boolean;
}

export const PillButton = forwardRef<HTMLButtonElement, PillButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      fullWidth = false,
      leftIcon,
      rightIcon,
      isLoading = false,
      disabled,
      children,
      type = 'button',
      ...props
    },
    ref
  ) => {
    const variantStyles: Record<NonNullable<PillButtonProps['variant']>, string> = {
      primary:
        'bg-gradient-to-r from-primary to-primary-accent text-white shadow-soft-primary hover:brightness-105',
      secondary:
        'bg-primary-50 text-primary-700 hover:bg-primary-100 border border-primary-200/60',
      safe: 'bg-semantic-safe text-white shadow-sm hover:brightness-105',
      warning: 'bg-semantic-warning text-white shadow-sm hover:brightness-105',
      danger: 'bg-semantic-danger text-white shadow-sm hover:brightness-105',
      ghost: 'bg-transparent text-ink-secondary hover:bg-slate-200/50 hover:text-ink-primary',
    };

    const sizeStyles: Record<NonNullable<PillButtonProps['size']>, string> = {
      sm: 'h-9 px-4 text-xs font-semibold gap-1.5',
      md: 'h-11 px-5 text-sm font-semibold gap-2',
      lg: 'h-13 px-7 text-base font-semibold gap-2.5 py-3.5',
    };

    const isDisabled = disabled || isLoading;

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        className={cn(
          'inline-flex items-center justify-center rounded-full select-none',
          'transition-all duration-200 ease-apple-spring',
          'active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
          variantStyles[variant],
          sizeStyles[size],
          fullWidth && 'w-full',
          isDisabled && 'opacity-50 pointer-events-none active:scale-100',
          className
        )}
        {...props}
      >
        {isLoading ? (
          <span
            className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
            aria-hidden="true"
          />
        ) : (
          leftIcon && <span className="shrink-0">{leftIcon}</span>
        )}
        <span className="truncate">{children}</span>
        {!isLoading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
      </button>
    );
  }
);

PillButton.displayName = 'PillButton';