// src/core/infrastructure/mappers/WeeklyCycleMapper.ts
import { WeeklyCycle } from '../../domain/entities/WeeklyCycle';
import { Money } from '../../domain/value-objects/Money';
import { WeekPeriod } from '../../domain/value-objects/WeekPeriod';
import {
  TransactionMapper,
  type TransactionPersistenceDTO,
} from './TransactionMapper';

export interface WeeklyCyclePersistenceDTO {
  id: string;
  weekKey: string;
  startDateISO: string;
  openingBalanceAmount: number;
  weeklyAllowanceAmount: number;
  currency: string;
  isClosed: boolean;
  transactions: TransactionPersistenceDTO[];
  categoryLimitsSnapshot?: Record<string, number>;
}

export class WeeklyCycleMapper {
  public static toPersistence(entity: WeeklyCycle): WeeklyCyclePersistenceDTO {
    return {
      id: entity.id,
      weekKey: entity.weekPeriod.weekKey,
      startDateISO: entity.weekPeriod.startDate.toISOString(),
      openingBalanceAmount: entity.openingBalance.amount,
      weeklyAllowanceAmount: entity.weeklyAllowance.amount,
      currency: entity.weeklyAllowance.currency,
      isClosed: entity.isClosed,
      transactions: entity.transactions.map((tx) =>
        TransactionMapper.toPersistence(tx)
      ),
      categoryLimitsSnapshot: { ...entity.categoryLimitsSnapshot },
    };
  }

  public static toDomain(dto: WeeklyCyclePersistenceDTO): WeeklyCycle {
    const currency = dto.currency || 'VND';
    const weekPeriod = WeekPeriod.fromDate(new Date(dto.startDateISO));
    const domainTransactions = (dto.transactions ?? []).map((txDto) =>
      TransactionMapper.toDomain(txDto)
    );

    return new WeeklyCycle({
      id: dto.id,
      weekPeriod,
      openingBalance: new Money(dto.openingBalanceAmount, currency),
      weeklyAllowance: new Money(dto.weeklyAllowanceAmount, currency),
      transactions: domainTransactions,
      isClosed: Boolean(dto.isClosed),
      categoryLimitsSnapshot: dto.categoryLimitsSnapshot
        ? { ...dto.categoryLimitsSnapshot }
        : {},
    });
  }
}