// src/app/layout.tsx
import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ExpenseTrackerProvider } from '@/components/providers/ExpenseTrackerProvider';

export const metadata: Metadata = {
  title: 'UniSpend - Quản lý Chi tiêu Tuần Sinh viên',
  description:
    'Ứng dụng PWA quản lý tài chính và ngân sách theo chu kỳ tuần dành cho sinh viên trên iPhone & MacBook.',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'UniSpend',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#F4F7FE',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className="antialiased selection:bg-primary/20 selection:text-primary">
        <ExpenseTrackerProvider>{children}</ExpenseTrackerProvider>
      </body>
    </html>
  );
}