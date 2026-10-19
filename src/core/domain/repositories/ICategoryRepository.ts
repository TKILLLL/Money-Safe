import type { Category } from '../entities/Category';

export interface ICategoryRepository {
  save(category: Category): Promise<void>;
  update(category: Category): Promise<void>;
  findById(id: string): Promise<Category | null>;
  findAll(includeArchived?: boolean): Promise<Category[]>;
}