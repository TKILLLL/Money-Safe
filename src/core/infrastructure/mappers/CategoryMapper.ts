import { Category, type CategoryType } from '../../domain/entities/Category';
import { Money } from '../../domain/value-objects/Money';

export interface CategoryPersistenceDTO {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: CategoryType;
  weeklyLimitAmount: number;
  currency: string;
  isArchived: boolean;
}

export class CategoryMapper {
  public static toPersistence(entity: Category): CategoryPersistenceDTO {
    return {
      id: entity.id,
      name: entity.name,
      icon: entity.icon,
      color: entity.color,
      type: entity.type,
      weeklyLimitAmount: entity.weeklyLimit.amount,
      currency: entity.weeklyLimit.currency,
      isArchived: entity.isArchived,
    };
  }

  public static toDomain(dto: CategoryPersistenceDTO): Category {
    return new Category({
      id: dto.id,
      name: dto.name,
      icon: dto.icon,
      color: dto.color,
      type: dto.type,
      weeklyLimit: new Money(dto.weeklyLimitAmount, dto.currency || 'VND'),
      isArchived: Boolean(dto.isArchived),
    });
  }
}