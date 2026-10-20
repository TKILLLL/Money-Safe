// src/core/infrastructure/di/DIContainer.ts
import { TransactionFactory } from '../../application/factories/TransactionFactory';
import { CalculateWeeklyAnalyticsUseCase } from '../../application/use-cases/CalculateWeeklyAnalyticsUseCase';
import { CreateTransactionUseCase } from '../../application/use-cases/CreateTransactionUseCase';
import { DeleteTransactionUseCase } from '../../application/use-cases/DeleteTransactionUseCase';
import { ManageCategoryUseCase } from '../../application/use-cases/ManageCategoryUseCase';
import { ManageWeeklyCycleUseCase } from '../../application/use-cases/ManageWeeklyCycleUseCase';
import { UpdateTransactionUseCase } from '../../application/use-cases/UpdateTransactionUseCase';
import type { IAuditLogRepository } from '../../domain/repositories/IAuditLogRepository';
import type { ICategoryRepository } from '../../domain/repositories/ICategoryRepository';
import type { ITransactionRepository } from '../../domain/repositories/ITransactionRepository';
import type { IWeeklyCycleRepository } from '../../domain/repositories/IWeeklyCycleRepository';
import { LocalStorageAuditLogRepository } from '../repositories/LocalStorageAuditLogRepository';
import { LocalStorageCategoryRepository } from '../repositories/LocalStorageCategoryRepository';
import { LocalStorageTransactionRepository } from '../repositories/LocalStorageTransactionRepository';
import { LocalStorageWeeklyCycleRepository } from '../repositories/LocalStorageWeeklyCycleRepository';
import {
  SupabaseAuditLogRepository,
  SupabaseCategoryRepository,
  SupabaseTransactionRepository,
  SupabaseWeeklyCycleRepository,
} from '../repositories/SupabaseRepositories';
import { SeedData } from '../SeedData';

export class DIContainer {
  private static instance: DIContainer | null = null;

  public readonly isCloudSyncEnabled: boolean;

  // Repositories
  public readonly transactionRepository: ITransactionRepository;
  public readonly categoryRepository: ICategoryRepository;
  public readonly weeklyCycleRepository: IWeeklyCycleRepository;
  public readonly auditLogRepository: IAuditLogRepository;

  // Factories
  public readonly transactionFactory: TransactionFactory;

  // Use Cases
  public readonly createTransactionUseCase: CreateTransactionUseCase;
  public readonly updateTransactionUseCase: UpdateTransactionUseCase;
  public readonly deleteTransactionUseCase: DeleteTransactionUseCase;
  public readonly manageCategoryUseCase: ManageCategoryUseCase;
  public readonly manageWeeklyCycleUseCase: ManageWeeklyCycleUseCase;
  public readonly calculateWeeklyAnalyticsUseCase: CalculateWeeklyAnalyticsUseCase;

  private constructor() {
    SeedData.ensureSeeded();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

    const localTxRepo = new LocalStorageTransactionRepository();
    const localCatRepo = new LocalStorageCategoryRepository();
    const localCycleRepo = new LocalStorageWeeklyCycleRepository();
    const localAuditRepo = new LocalStorageAuditLogRepository();

    if (supabaseUrl && supabaseAnonKey) {
      this.isCloudSyncEnabled = true;
      const config = { url: supabaseUrl, anonKey: supabaseAnonKey };

      this.transactionRepository = new SupabaseTransactionRepository(
        config,
        localTxRepo
      );
      this.categoryRepository = new SupabaseCategoryRepository(
        config,
        localCatRepo
      );
      this.weeklyCycleRepository = new SupabaseWeeklyCycleRepository(
        config,
        this.transactionRepository,
        localCycleRepo
      );
      this.auditLogRepository = new SupabaseAuditLogRepository(
        config,
        localAuditRepo
      );
    } else {
      this.isCloudSyncEnabled = false;
      this.transactionRepository = localTxRepo;
      this.categoryRepository = localCatRepo;
      this.weeklyCycleRepository = localCycleRepo;
      this.auditLogRepository = localAuditRepo;
    }

    this.transactionFactory = new TransactionFactory();

    this.createTransactionUseCase = new CreateTransactionUseCase(
      this.transactionRepository,
      this.categoryRepository,
      this.weeklyCycleRepository,
      this.auditLogRepository
    );

    this.updateTransactionUseCase = new UpdateTransactionUseCase(
      this.transactionRepository,
      this.categoryRepository,
      this.weeklyCycleRepository,
      this.auditLogRepository
    );

    this.deleteTransactionUseCase = new DeleteTransactionUseCase(
      this.transactionRepository,
      this.weeklyCycleRepository,
      this.auditLogRepository,
      this.categoryRepository
    );

    this.manageCategoryUseCase = new ManageCategoryUseCase(
      this.categoryRepository,
      this.auditLogRepository,
      this.weeklyCycleRepository
    );

    this.manageWeeklyCycleUseCase = new ManageWeeklyCycleUseCase(
      this.weeklyCycleRepository,
      this.transactionRepository,
      this.categoryRepository,
      this.auditLogRepository
    );

    this.calculateWeeklyAnalyticsUseCase = new CalculateWeeklyAnalyticsUseCase(
      this.weeklyCycleRepository,
      this.transactionRepository,
      this.categoryRepository
    );
  }

  public static getInstance(): DIContainer {
    if (!DIContainer.instance) {
      DIContainer.instance = new DIContainer();
    }
    return DIContainer.instance;
  }
}

export const diContainer = DIContainer.getInstance();