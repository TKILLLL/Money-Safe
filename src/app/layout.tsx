// src/app/layout.tsx
import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ExpenseTrackerProvider } from '@/components/providers/ExpenseTrackerProvider';

export const metadata: Metadata = {
  title: 'UniSpend - Quản lý Chi tiêu Tuần Sinh viên',
  description:
    'Ứng dụng PWA quản lý tài chính và ngân sách theo chu kỳ tuần dành cho sinh viên trên iPhone & MacBook.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'UniSpend',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#F4F7FE',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className="antialiased selection:bg-primary/20 selection:text-primary"
      >
        <ExpenseTrackerProvider>{children}</ExpenseTrackerProvider>
      </body>
    </html>
  );
}