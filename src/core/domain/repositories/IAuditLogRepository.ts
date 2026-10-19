import type { AuditLog } from '../entities/AuditLog';
import type { WeekPeriod } from '../value-objects/WeekPeriod';

export interface IAuditLogRepository {
  log(entry: AuditLog): Promise<void>;
  findByWeekPeriod(period: WeekPeriod): Promise<AuditLog[]>;
}