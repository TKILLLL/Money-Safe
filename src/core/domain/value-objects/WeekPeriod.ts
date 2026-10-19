const MS_PER_DAY = 24 * 60 * 60 * 1000;

export class WeekPeriod {
  private readonly _startDate: Date;
  private readonly _endDate: Date;

  public constructor(referenceDate: Date = new Date()) {
    if (!(referenceDate instanceof Date) || Number.isNaN(referenceDate.getTime())) {
      throw new Error('Ngày tham chiếu (referenceDate) không hợp lệ.');
    }

    const { monday, sunday } = WeekPeriod.computeBounds(referenceDate);
    this._startDate = monday;
    this._endDate = sunday;
  }

  public static fromDate(date: Date): WeekPeriod {
    return new WeekPeriod(date);
  }

  public static currentWeek(): WeekPeriod {
    return new WeekPeriod(new Date());
  }

  /**
   * Tính toán chính xác Thứ Hai (00:00:00.000) và Chủ Nhật (23:59:59.999)
   */
  private static computeBounds(date: Date): { monday: Date; sunday: Date } {
    const dayOfWeek = date.getDay(); // 0 (Chủ Nhật) -> 6 (Thứ Bảy)
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

    const monday = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate() + diffToMonday,
      0,
      0,
      0,
      0
    );

    const sunday = new Date(
      monday.getFullYear(),
      monday.getMonth(),
      monday.getDate() + 6,
      23,
      59,
      59,
      999
    );

    return { monday, sunday };
  }

  public get startDate(): Date {
    return new Date(this._startDate.getTime());
  }

  public get endDate(): Date {
    return new Date(this._endDate.getTime());
  }

  /**
   * Mã định danh duy nhất cho tuần theo ngày Thứ Hai (VD: "2026-10-19")
   */
  public get weekKey(): string {
    const year = this._startDate.getFullYear();
    const month = String(this._startDate.getMonth() + 1).padStart(2, '0');
    const day = String(this._startDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Kiểm tra một thời điểm bất kỳ có nằm trong tuần này hay không
   */
  public contains(date: Date): boolean {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
      return false;
    }
    const time = date.getTime();
    return time >= this._startDate.getTime() && time <= this._endDate.getTime();
  }

  /**
   * Trả về chu kỳ tuần kế tiếp
   */
  public getNextWeek(): WeekPeriod {
    const nextMonday = new Date(
      this._startDate.getFullYear(),
      this._startDate.getMonth(),
      this._startDate.getDate() + 7,
      12,
      0,
      0,
      0
    );
    return new WeekPeriod(nextMonday);
  }

  /**
   * Trả về chu kỳ tuần trước đó
   */
  public getPreviousWeek(): WeekPeriod {
    const prevMonday = new Date(
      this._startDate.getFullYear(),
      this._startDate.getMonth(),
      this._startDate.getDate() - 7,
      12,
      0,
      0,
      0
    );
    return new WeekPeriod(prevMonday);
  }

  /**
   * Tính số ngày còn lại trong tuần tính từ currentDate (luôn trả về từ 1 đến 7 ngày).
   * - Thứ Hai: còn 7 ngày (tính cả ngày Thứ Hai)
   * - Chủ Nhật: còn 1 ngày
   */
  public getRemainingDaysFrom(currentDate: Date = new Date()): number {
    if (!(currentDate instanceof Date) || Number.isNaN(currentDate.getTime())) {
      throw new Error('Ngày tính toán (currentDate) không hợp lệ.');
    }

    if (currentDate.getTime() < this._startDate.getTime()) {
      return 7;
    }

    if (currentDate.getTime() > this._endDate.getTime()) {
      return 1;
    }

    const currentDayStart = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      currentDate.getDate(),
      0,
      0,
      0,
      0
    );

    const sundayDayStart = new Date(
      this._endDate.getFullYear(),
      this._endDate.getMonth(),
      this._endDate.getDate(),
      0,
      0,
      0,
      0
    );

    const diffDays = Math.round((sundayDayStart.getTime() - currentDayStart.getTime()) / MS_PER_DAY) + 1;
    return Math.min(Math.max(diffDays, 1), 7);
  }

  /**
   * Định dạng nhãn hiển thị tuần (VD: "19/10 - 25/10/2026")
   */
  public formatLabel(): string {
    const startDay = String(this._startDate.getDate()).padStart(2, '0');
    const startMonth = String(this._startDate.getMonth() + 1).padStart(2, '0');
    const startYear = this._startDate.getFullYear();

    const endDay = String(this._endDate.getDate()).padStart(2, '0');
    const endMonth = String(this._endDate.getMonth() + 1).padStart(2, '0');
    const endYear = this._endDate.getFullYear();

    if (startYear !== endYear) {
      return `${startDay}/${startMonth}/${startYear} - ${endDay}/${endMonth}/${endYear}`;
    }

    return `${startDay}/${startMonth} - ${endDay}/${endMonth}/${endYear}`;
  }

  public equals(other: WeekPeriod): boolean {
    return this._startDate.getTime() === other._startDate.getTime();
  }
}