// src/core/infrastructure/repositories/LocalStorageWeeklyCycleRepository.ts
import type { WeeklyCycle } from '../../domain/entities/WeeklyCycle';
import type { IWeeklyCycleRepository } from '../../domain/repositories/IWeeklyCycleRepository';
import type { WeekPeriod } from '../../domain/value-objects/WeekPeriod';
import {
  WeeklyCycleMapper,
  type WeeklyCyclePersistenceDTO,
} from '../mappers/WeeklyCycleMapper';
import { SeedData, STORAGE_KEYS } from '../SeedData';

export class LocalStorageWeeklyCycleRepository implements IWeeklyCycleRepository {
  private ssrMemoryStore: WeeklyCyclePersistenceDTO[] = [];

  private isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  }

  private readAllDTOs(): WeeklyCyclePersistenceDTO[] {
    if (!this.isBrowser()) {
      return this.ssrMemoryStore;
    }

    SeedData.ensureSeeded();
    const raw = window.localStorage.getItem(STORAGE_KEYS.WEEKLY_CYCLES);
    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? (parsed as WeeklyCyclePersistenceDTO[]) : [];
    } catch {
      return [];
    }
  }

  private writeAllDTOs(dtos: WeeklyCyclePersistenceDTO[]): void {
    if (!this.isBrowser()) {
      this.ssrMemoryStore = dtos;
      return;
    }
    SeedData.markAsSeededPermanently();
    window.localStorage.setItem(STORAGE_KEYS.WEEKLY_CYCLES, JSON.stringify(dtos));
  }

  public async save(cycle: WeeklyCycle): Promise<void> {
    const dtos = this.readAllDTOs();
    const dto = WeeklyCycleMapper.toPersistence(cycle);
    const existingIndex = dtos.findIndex(
      (item) => item.id === dto.id || item.weekKey === dto.weekKey
    );

    if (existingIndex >= 0) {
      dtos[existingIndex] = dto;
    } else {
      dtos.push(dto);
    }

    this.writeAllDTOs(dtos);
  }

  public async update(cycle: WeeklyCycle): Promise<void> {
    await this.save(cycle);
  }

  public async clearAll(): Promise<void> {
    SeedData.markAsSeededPermanently();
    this.writeAllDTOs([]);
  }

  public async findByWeekPeriod(period: WeekPeriod): Promise<WeeklyCycle | null> {
    const dtos = this.readAllDTOs();
    const targetKey = period.weekKey;

    const found = dtos.find((dto) => {
      if (dto.weekKey === targetKey) {
        return true;
      }
      const hydrated = WeeklyCycleMapper.toDomain(dto);
      return hydrated.weekPeriod.equals(period);
    });

    return found ? WeeklyCycleMapper.toDomain(found) : null;
  }

  public async findAllCycles(): Promise<WeeklyCycle[]> {
    const dtos = this.readAllDTOs();
    return dtos
      .map((dto) => WeeklyCycleMapper.toDomain(dto))
      .sort(
        (a, b) =>
          b.weekPeriod.startDate.getTime() - a.weekPeriod.startDate.getTime()
      );
  }
}