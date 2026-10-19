-- supabase_schema.sql
-- Khởi tạo Schema PostgreSQL cho Ứng dụng Quản lý Chi tiêu Tuần Sinh viên (UniSpend)

-- 1. Bảng Danh mục (categories)
CREATE TABLE IF NOT EXISTS public.categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  color TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('EXPENSE', 'INCOME', 'SAVING')),
  weekly_limit_amount BIGINT NOT NULL DEFAULT 0 CHECK (weekly_limit_amount >= 0),
  currency TEXT NOT NULL DEFAULT 'VND',
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Bảng Chu kỳ Tuần (weekly_cycles)
CREATE TABLE IF NOT EXISTS public.weekly_cycles (
  id TEXT PRIMARY KEY,
  week_key TEXT NOT NULL UNIQUE, -- Định dạng YYYY-MM-DD (Thứ Hai đầu tuần)
  start_date_iso TIMESTAMPTZ NOT NULL,
  opening_balance_amount BIGINT NOT NULL DEFAULT 0,
  weekly_allowance_amount BIGINT NOT NULL DEFAULT 0 CHECK (weekly_allowance_amount >= 0),
  currency TEXT NOT NULL DEFAULT 'VND',
  is_closed BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Bảng Giao dịch (transactions)
CREATE TABLE IF NOT EXISTS public.transactions (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('EXPENSE', 'INCOME', 'SAVING')),
  amount BIGINT NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'VND',
  category_id TEXT NOT NULL REFERENCES public.categories(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  timestamp_iso TIMESTAMPTZ NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at_iso TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Bảng Nhật ký Hệ thống (audit_logs)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL CHECK (action IN ('CREATE', 'UPDATE', 'DELETE')),
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  description TEXT NOT NULL,
  timestamp_iso TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Khởi tạo Indexes tối ưu hóa truy vấn theo chu kỳ tuần (Thứ 2 -> Chủ Nhật)
CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON public.transactions (timestamp_iso DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON public.transactions (category_id);
CREATE INDEX IF NOT EXISTS idx_weekly_cycles_week_key ON public.weekly_cycles (week_key DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.audit_logs (timestamp_iso DESC);

-- Kích hoạt Row Level Security (RLS) cho phép truy cập qua Anon Key trong phạm vi cá nhân
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'categories' AND policyname = 'Allow all access to categories') THEN
    CREATE POLICY "Allow all access to categories" ON public.categories FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'weekly_cycles' AND policyname = 'Allow all access to weekly_cycles') THEN
    CREATE POLICY "Allow all access to weekly_cycles" ON public.weekly_cycles FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'transactions' AND policyname = 'Allow all access to transactions') THEN
    CREATE POLICY "Allow all access to transactions" ON public.transactions FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'audit_logs' AND policyname = 'Allow all access to audit_logs') THEN
    CREATE POLICY "Allow all access to audit_logs" ON public.audit_logs FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Khởi tạo sẵn 8 Danh mục mặc định chuẩn nhu cầu sinh viên
INSERT INTO public.categories (id, name, icon, color, type, weekly_limit_amount, currency, is_archived)
VALUES
  ('cat_food', 'Ăn uống', 'Utensils', '#F97316', 'EXPENSE', 350000, 'VND', FALSE),
  ('cat_weekly_shopping', 'Chi tiêu hàng tuần', 'ShoppingBag', '#10B981', 'EXPENSE', 120000, 'VND', FALSE),
  ('cat_laundry', 'Giặt ủi & giặt sấy', 'Shirt', '#3B82F6', 'EXPENSE', 50000, 'VND', FALSE),
  ('cat_utilities', 'Tiền điện & nước', 'Droplets', '#06B6D4', 'EXPENSE', 70000, 'VND', FALSE),
  ('cat_internet', 'Mạng', 'Smartphone', '#64748B', 'EXPENSE', 35000, 'VND', FALSE),
  ('cat_gym', 'Gym', 'Dumbbell', '#0EA5E9', 'EXPENSE', 65000, 'VND', FALSE),
  ('cat_incidentals', 'Chi phí phát sinh', 'Pencil', '#EAB308', 'EXPENSE', 80000, 'VND', FALSE),
  ('cat_saving', 'Tiết kiệm', 'Landmark', '#84CC16', 'SAVING', 100000, 'VND', FALSE)
ON CONFLICT (id) DO NOTHING;