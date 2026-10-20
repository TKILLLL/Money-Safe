// src/core/domain/repositories/IWeeklyCycleRepository.ts
import type { WeeklyCycle } from '../entities/WeeklyCycle';
import type { WeekPeriod } from '../value-objects/WeekPeriod';

export interface IWeeklyCycleRepository {
  save(cycle: WeeklyCycle): Promise<void>;
  update(cycle: WeeklyCycle): Promise<void>;
  clearAll(): Promise<void>;
  findByWeekPeriod(period: WeekPeriod): Promise<WeeklyCycle | null>;
  findAllCycles(): Promise<WeeklyCycle[]>;
}