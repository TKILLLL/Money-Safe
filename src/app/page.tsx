// src/app/page.tsx
import { AppShell } from '@/components/screens/AppShell';
import { CalendarLogScreen } from '@/components/screens/CalendarLogScreen';
import { QuickEntryScreen } from '@/components/screens/QuickEntryScreen';
import { WeeklyAnalyticsScreen } from '@/components/screens/WeeklyAnalyticsScreen';
import { WeeklyBudgetScreen } from '@/components/screens/WeeklyBudgetScreen';

export default function HomePage() {
  return (
    <AppShell
      inputScreen={<QuickEntryScreen />}
      calendarScreen={<CalendarLogScreen />}
      analyticsScreen={<WeeklyAnalyticsScreen />}
      budgetScreen={<WeeklyBudgetScreen />}
    />
  );
}