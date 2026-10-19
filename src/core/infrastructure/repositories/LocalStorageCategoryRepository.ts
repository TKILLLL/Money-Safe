// src/core/infrastructure/repositories/LocalStorageCategoryRepository.ts
import type { Category } from '../../domain/entities/Category';
import type { ICategoryRepository } from '../../domain/repositories/ICategoryRepository';
import {
  CategoryMapper,
  type CategoryPersistenceDTO,
} from '../mappers/CategoryMapper';
import { SeedData, STORAGE_KEYS } from '../SeedData';

export class LocalStorageCategoryRepository implements ICategoryRepository {
  private ssrMemoryStore: CategoryPersistenceDTO[] = [];

  private isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  }

  private readAllDTOs(): CategoryPersistenceDTO[] {
    if (!this.isBrowser()) {
      if (this.ssrMemoryStore.length === 0) {
        this.ssrMemoryStore = SeedData.createDefaultStudentCategories().map((cat) =>
          CategoryMapper.toPersistence(cat)
        );
      }
      return this.ssrMemoryStore;
    }

    SeedData.ensureSeeded();
    const raw = window.localStorage.getItem(STORAGE_KEYS.CATEGORIES);
    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? (parsed as CategoryPersistenceDTO[]) : [];
    } catch {
      return [];
    }
  }

  private writeAllDTOs(dtos: CategoryPersistenceDTO[]): void {
    if (!this.isBrowser()) {
      this.ssrMemoryStore = dtos;
      return;
    }
    window.localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(dtos));
  }

  public async save(category: Category): Promise<void> {
    const dtos = this.readAllDTOs();
    const dto = CategoryMapper.toPersistence(category);
    const existingIndex = dtos.findIndex((item) => item.id === dto.id);

    if (existingIndex >= 0) {
      dtos[existingIndex] = dto;
    } else {
      dtos.push(dto);
    }

    this.writeAllDTOs(dtos);
  }

  public async update(category: Category): Promise<void> {
    const dtos = this.readAllDTOs();
    const index = dtos.findIndex((item) => item.id === category.id);
    if (index === -1) {
      throw new Error(`Không tìm thấy danh mục "${category.id}" để cập nhật.`);
    }

    dtos[index] = CategoryMapper.toPersistence(category);
    this.writeAllDTOs(dtos);
  }

  public async findById(id: string): Promise<Category | null> {
    const dtos = this.readAllDTOs();
    const found = dtos.find((item) => item.id === id);
    return found ? CategoryMapper.toDomain(found) : null;
  }

  public async findAll(includeArchived: boolean = false): Promise<Category[]> {
    const dtos = this.readAllDTOs();
    const categories = dtos.map((dto) => CategoryMapper.toDomain(dto));

    if (includeArchived) {
      return categories;
    }
    return categories.filter((cat) => !cat.isArchived);
  }
}