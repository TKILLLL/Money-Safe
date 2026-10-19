// src/app/page.tsx
import { AppShell } from '@/components/screens/AppShell';
import { QuickEntryScreen } from '@/components/screens/QuickEntryScreen';

export default function HomePage() {
  return <AppShell inputScreen={<QuickEntryScreen />} />;
}