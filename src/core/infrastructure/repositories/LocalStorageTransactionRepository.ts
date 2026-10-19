// src/core/infrastructure/repositories/LocalStorageTransactionRepository.ts
import type { Transaction } from '../../domain/entities/Transaction';
import type { ITransactionRepository } from '../../domain/repositories/ITransactionRepository';
import type { WeekPeriod } from '../../domain/value-objects/WeekPeriod';
import {
  TransactionMapper,
  type TransactionPersistenceDTO,
} from '../mappers/TransactionMapper';
import { SeedData, STORAGE_KEYS } from '../SeedData';

export class LocalStorageTransactionRepository implements ITransactionRepository {
  private ssrMemoryStore: TransactionPersistenceDTO[] = [];

  private isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  }

  private readAllDTOs(): TransactionPersistenceDTO[] {
    if (!this.isBrowser()) {
      return this.ssrMemoryStore;
    }

    SeedData.ensureSeeded();
    const raw = window.localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? (parsed as TransactionPersistenceDTO[]) : [];
    } catch {
      return [];
    }
  }

  private writeAllDTOs(dtos: TransactionPersistenceDTO[]): void {
    if (!this.isBrowser()) {
      this.ssrMemoryStore = dtos;
      return;
    }
    window.localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(dtos));
  }

  public async save(transaction: Transaction): Promise<void> {
    const dtos = this.readAllDTOs();
    const dto = TransactionMapper.toPersistence(transaction);
    const existingIndex = dtos.findIndex((item) => item.id === dto.id);

    if (existingIndex >= 0) {
      dtos[existingIndex] = dto;
    } else {
      dtos.push(dto);
    }

    this.writeAllDTOs(dtos);
  }

  public async update(transaction: Transaction): Promise<void> {
    const dtos = this.readAllDTOs();
    const index = dtos.findIndex((item) => item.id === transaction.id);
    if (index === -1) {
      throw new Error(`Không tìm thấy giao dịch "${transaction.id}" trong kho lưu trữ.`);
    }

    dtos[index] = TransactionMapper.toPersistence(transaction);
    this.writeAllDTOs(dtos);
  }

  public async delete(id: string): Promise<void> {
    const dtos = this.readAllDTOs();
    const filtered = dtos.filter((item) => item.id !== id);
    this.writeAllDTOs(filtered);
  }

  public async findById(id: string): Promise<Transaction | null> {
    const dtos = this.readAllDTOs();
    const found = dtos.find((item) => item.id === id);
    return found ? TransactionMapper.toDomain(found) : null;
  }

  public async findByWeekPeriod(period: WeekPeriod): Promise<Transaction[]> {
    const dtos = this.readAllDTOs();
    const domainList = dtos
      .map((dto) => TransactionMapper.toDomain(dto))
      .filter((tx) => period.contains(tx.timestamp));

    return domainList.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  public async findByDateRange(start: Date, end: Date): Promise<Transaction[]> {
    const startTime = start.getTime();
    const endTime = end.getTime();

    const dtos = this.readAllDTOs();
    const domainList = dtos
      .map((dto) => TransactionMapper.toDomain(dto))
      .filter((tx) => {
        const time = tx.timestamp.getTime();
        return time >= startTime && time <= endTime;
      });

    return domainList.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }
}