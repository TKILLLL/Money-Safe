// src/app/page.tsx
import { Suspense } from 'react';
import { AppShell } from '@/components/screens/AppShell';
import { CalendarLogScreen } from '@/components/screens/CalendarLogScreen';
import { QuickEntryScreen } from '@/components/screens/QuickEntryScreen';
import { WeeklyAnalyticsScreen } from '@/components/screens/WeeklyAnalyticsScreen';
import { WeeklyBudgetScreen } from '@/components/screens/WeeklyBudgetScreen';

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-dvh bg-background flex items-center justify-center p-6">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-primary border-t-transparent" />
        </div>
      }
    >
      <AppShell
        inputScreen={<QuickEntryScreen />}
        calendarScreen={<CalendarLogScreen />}
        analyticsScreen={<WeeklyAnalyticsScreen />}
        budgetScreen={<WeeklyBudgetScreen />}
      />
    </Suspense>
  );
}