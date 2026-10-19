// src/components/ui/CategoryIcon.tsx
import React from 'react';
import {
  BookOpen,
  Bus,
  Coffee,
  CreditCard,
  Droplets,
  Dumbbell,
  Film,
  Gamepad2,
  Gift,
  GraduationCap,
  HeartPulse,
  Home,
  Landmark,
  Laptop,
  MoreHorizontal,
  Music,
  Pencil,
  PiggyBank,
  Shirt,
  ShoppingBag,
  Smartphone,
  Sparkles,
  TrendingUp,
  Utensils,
  Wallet,
  Wifi,
  type LucideProps,
} from 'lucide-react';

export const CATEGORY_ICON_MAP: Record<string, React.ComponentType<LucideProps>> = {
  Utensils,
  ShoppingBag,
  Shirt,
  Droplets,
  Smartphone,
  Dumbbell,
  Pencil,
  Landmark,
  Coffee,
  Bus,
  BookOpen,
  GraduationCap,
  Home,
  Laptop,
  HeartPulse,
  GamePad: Gamepad2,
  Gamepad2,
  Film,
  Music,
  Gift,
  PiggyBank,
  Wallet,
  TrendingUp,
  CreditCard,
  Wifi,
  Sparkles,
  MoreHorizontal,
};

export const AVAILABLE_CATEGORY_ICONS: readonly { name: string; label: string }[] = [
  { name: 'Utensils', label: 'Ăn uống' },
  { name: 'Coffee', label: 'Cà phê / Trà sữa' },
  { name: 'ShoppingBag', label: 'Mua sắm' },
  { name: 'Shirt', label: 'Giặt ủi / Quần áo' },
  { name: 'Droplets', label: 'Điện & Nước' },
  { name: 'Smartphone', label: 'Mạng / Điện thoại' },
  { name: 'Dumbbell', label: 'Gym / Thể thao' },
  { name: 'Pencil', label: 'Học tập / Phát sinh' },
  { name: 'Landmark', label: 'Tiết kiệm / Ngân hàng' },
  { name: 'Bus', label: 'Di chuyển / Xăng xe' },
  { name: 'Home', label: 'Tiền trọ / Ký túc xá' },
  { name: 'BookOpen', label: 'Sách vở & Giáo trình' },
  { name: 'Laptop', label: 'Thiết bị / Phần mềm' },
  { name: 'HeartPulse', label: 'Y tế / Sức khỏe' },
  { name: 'Gamepad2', label: 'Giải trí' },
  { name: 'Gift', label: 'Quà tặng / Hiếu hỉ' },
  { name: 'Wallet', label: 'Chu cấp / Lương' },
  { name: 'TrendingUp', label: 'Thưởng / Học bổng' },
  { name: 'PiggyBank', label: 'Heo đất tích lũy' },
];

export const CATEGORY_COLOR_PALETTE: readonly string[] = [
  '#F97316', // Cam (Ăn uống)
  '#10B981', // Xanh lá (Chi tiêu tuần)
  '#3B82F6', // Xanh dương (Giặt ủi)
  '#06B6D4', // Xanh cyan (Điện nước)
  '#64748B', // Xám xanh (Mạng)
  '#0EA5E9', // Xanh biển (Gym)
  '#EAB308', // Vàng (Phát sinh)
  '#84CC16', // Xanh neon (Tiết kiệm)
  '#8B5CF6', // Tím Lavender
  '#EC4899', // Hồng
  '#EF4444', // Đỏ
  '#14B8A6', // Xanh ngọc
];

export interface CategoryIconProps extends LucideProps {
  iconName: string;
}

export const CategoryIcon: React.FC<CategoryIconProps> = ({
  iconName,
  className = 'h-5 w-5',
  ...props
}) => {
  const IconComponent = CATEGORY_ICON_MAP[iconName] ?? MoreHorizontal;
  return <IconComponent className={className} {...props} />;
};