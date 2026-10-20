// src/core/infrastructure/repositories/LocalStorageAuditLogRepository.ts
import type { AuditLog } from '../../domain/entities/AuditLog';
import type { IAuditLogRepository } from '../../domain/repositories/IAuditLogRepository';
import type { WeekPeriod } from '../../domain/value-objects/WeekPeriod';
import {
  AuditLogMapper,
  type AuditLogPersistenceDTO,
} from '../mappers/AuditLogMapper';
import { SeedData, STORAGE_KEYS } from '../SeedData';

export class LocalStorageAuditLogRepository implements IAuditLogRepository {
  private ssrMemoryStore: AuditLogPersistenceDTO[] = [];

  private isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  }

  private readAllDTOs(): AuditLogPersistenceDTO[] {
    if (!this.isBrowser()) {
      return this.ssrMemoryStore;
    }

    SeedData.ensureSeeded();
    const raw = window.localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS);
    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? (parsed as AuditLogPersistenceDTO[]) : [];
    } catch {
      return [];
    }
  }

  private writeAllDTOs(dtos: AuditLogPersistenceDTO[]): void {
    if (!this.isBrowser()) {
      this.ssrMemoryStore = dtos;
      return;
    }
    SeedData.markAsSeededPermanently();
    window.localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(dtos));
  }

  public async log(entry: AuditLog): Promise<void> {
    const dtos = this.readAllDTOs();
    const dto = AuditLogMapper.toPersistence(entry);
    dtos.unshift(dto);
    this.writeAllDTOs(dtos);
  }

  public async clearAll(): Promise<void> {
    SeedData.markAsSeededPermanently();
    this.writeAllDTOs([]);
  }

  public async findByWeekPeriod(period: WeekPeriod): Promise<AuditLog[]> {
    const dtos = this.readAllDTOs();
    const domainLogs = dtos
      .map((dto) => AuditLogMapper.toDomain(dto))
      .filter((log) => period.contains(log.timestamp));

    return domainLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }
}