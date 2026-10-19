import { Money } from '../value-objects/Money';

export type TransactionType = 'EXPENSE' | 'INCOME' | 'SAVING';
export type CategoryType = TransactionType;

export interface CategoryProps {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: CategoryType;
  weeklyLimit: Money;
  isArchived?: boolean;
}

export interface UpdateCategoryInfoParams {
  name?: string;
  icon?: string;
  color?: string;
}

const HEX_COLOR_REGEX = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;

export class Category {
  private readonly _id: string;
  private _name: string;
  private _icon: string;
  private _color: string;
  private readonly _type: CategoryType;
  private _weeklyLimit: Money;
  private _isArchived: boolean;

  public constructor(props: CategoryProps) {
    if (!props.id || !props.id.trim()) {
      throw new Error('ID danh mục (Category.id) không được để trống.');
    }

    this._id = props.id.trim();
    this._type = props.type;
    this._isArchived = Boolean(props.isArchived);

    this._name = Category.validateName(props.name);
    this._icon = Category.validateIcon(props.icon);
    this._color = Category.validateColor(props.color);
    this._weeklyLimit = Category.validateLimit(props.weeklyLimit);
  }

  private static validateName(name: string): string {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error('Tên danh mục không được để trống.');
    }
    if (trimmed.length > 50) {
      throw new Error('Tên danh mục không được vượt quá 50 ký tự.');
    }
    return trimmed;
  }

  private static validateIcon(icon: string): string {
    const trimmed = icon.trim();
    if (!trimmed) {
      throw new Error('Icon danh mục (Lucide icon name) không được để trống.');
    }
    return trimmed;
  }

  private static validateColor(color: string): string {
    const trimmed = color.trim();
    if (!HEX_COLOR_REGEX.test(trimmed)) {
      throw new Error(`Mã màu "${color}" không đúng định dạng Hex (VD: #8B5CF6).`);
    }
    return trimmed.toUpperCase();
  }

  private static validateLimit(limit: Money): Money {
    if (limit.isNegative()) {
      throw new Error('Hạn mức tuần của danh mục không được là số âm.');
    }
    return limit;
  }

  // Getters
  public get id(): string {
    return this._id;
  }

  public get name(): string {
    return this._name;
  }

  public get icon(): string {
    return this._icon;
  }

  public get color(): string {
    return this._color;
  }

  public get type(): CategoryType {
    return this._type;
  }

  public get weeklyLimit(): Money {
    return this._weeklyLimit;
  }

  public get isArchived(): boolean {
    return this._isArchived;
  }

  /**
   * Cập nhật thông tin hiển thị của danh mục (hỗ trợ cả truyền object hoặc truyền từng tham số)
   */
  public updateInfo(params: UpdateCategoryInfoParams): void;
  public updateInfo(name: string, icon: string, color: string): void;
  public updateInfo(
    nameOrParams: string | UpdateCategoryInfoParams,
    icon?: string,
    color?: string
  ): void {
    if (typeof nameOrParams === 'string') {
      this._name = Category.validateName(nameOrParams);
      if (icon !== undefined) this._icon = Category.validateIcon(icon);
      if (color !== undefined) this._color = Category.validateColor(color);
      return;
    }

    if (nameOrParams.name !== undefined) {
      this._name = Category.validateName(nameOrParams.name);
    }
    if (nameOrParams.icon !== undefined) {
      this._icon = Category.validateIcon(nameOrParams.icon);
    }
    if (nameOrParams.color !== undefined) {
      this._color = Category.validateColor(nameOrParams.color);
    }
  }

  /**
   * Thay đổi hạn mức chi tiêu hàng tuần của danh mục
   */
  public changeWeeklyLimit(newLimit: Money): void {
    this._weeklyLimit = Category.validateLimit(newLimit);
  }

  public archive(): void {
    this._isArchived = true;
  }

  public unarchive(): void {
    this._isArchived = false;
  }

  /**
   * Kiểm tra số tiền đã chi của danh mục này có vượt hạn mức tuần hay chưa
   */
  public isLimitExceeded(spentAmount: Money): boolean {
    if (this._weeklyLimit.isZero()) {
      return false; // Không giới hạn nếu weeklyLimit = 0
    }
    return spentAmount.isGreaterThan(this._weeklyLimit);
  }
}