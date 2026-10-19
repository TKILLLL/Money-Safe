export class Money {
  private readonly _amount: number;
  private readonly _currency: string;

  public constructor(amount: number, currency: string = 'VND') {
    if (!Number.isFinite(amount)) {
      throw new Error('Số tiền (Money.amount) phải là một số hữu hạn hợp lệ.');
    }

    const normalizedCurrency = currency.trim().toUpperCase();
    if (!normalizedCurrency) {
      throw new Error('Đơn vị tiền tệ (Money.currency) không được để trống.');
    }

    // Làm tròn về số nguyên gần nhất (chuẩn tiền tệ VND không dùng số thập phân)
    this._amount = Math.round(amount);
    this._currency = normalizedCurrency;
  }

  public static zero(currency: string = 'VND'): Money {
    return new Money(0, currency);
  }

  public static fromAmount(amount: number, currency: string = 'VND'): Money {
    return new Money(amount, currency);
  }

  public get amount(): number {
    return this._amount;
  }

  public get currency(): string {
    return this._currency;
  }

  private assertSameCurrency(other: Money): void {
    if (this._currency !== other._currency) {
      throw new Error(
        `Không thể thực hiện phép toán giữa hai đơn vị tiền tệ khác nhau: ${this._currency} và ${other._currency}.`
      );
    }
  }

  public add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this._amount + other._amount, this._currency);
  }

  public subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this._amount - other._amount, this._currency);
  }

  public multiply(factor: number): Money {
    if (!Number.isFinite(factor)) {
      throw new Error('Hệ số nhân phải là một số hữu hạn.');
    }
    return new Money(this._amount * factor, this._currency);
  }

  public divide(divisor: number): Money {
    if (!Number.isFinite(divisor) || divisor === 0) {
      throw new Error('Số chia phải là số hữu hạn khác 0.');
    }
    return new Money(this._amount / divisor, this._currency);
  }

  public isGreaterThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this._amount > other._amount;
  }

  public isGreaterThanOrEqual(other: Money): boolean {
    this.assertSameCurrency(other);
    return this._amount >= other._amount;
  }

  public isLessThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this._amount < other._amount;
  }

  public isZero(): boolean {
    return this._amount === 0;
  }

  public isPositive(): boolean {
    return this._amount > 0;
  }

  public isNegative(): boolean {
    return this._amount < 0;
  }

  public abs(): Money {
    return new Money(Math.abs(this._amount), this._currency);
  }

  public equals(other: Money): boolean {
    return this._currency === other._currency && this._amount === other._amount;
  }

  /**
   * Định dạng hiển thị tiền Việt Nam Đồng (VD: 212,000đ hoặc -50,000đ)
   */
  public formatVND(): string {
    const isNeg = this._amount < 0;
    const absoluteString = Math.abs(this._amount)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, ',');

    return `${isNeg ? '-' : ''}${absoluteString}đ`;
  }

  public toString(): string {
    return this.formatVND();
  }
}