// src/core/infrastructure/mappers/AuditLogMapper.ts
import { AuditLog, type AuditAction } from '../../domain/entities/AuditLog';

export interface AuditLogPersistenceDTO {
  id: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  description: string;
  timestampISO: string;
}

export class AuditLogMapper {
  public static toPersistence(entity: AuditLog): AuditLogPersistenceDTO {
    return {
      id: entity.id,
      action: entity.action,
      entityType: entity.entityType,
      entityId: entity.entityId,
      description: entity.description,
      timestampISO: entity.timestamp.toISOString(),
    };
  }

  public static toDomain(dto: AuditLogPersistenceDTO): AuditLog {
    return new AuditLog({
      id: dto.id,
      action: dto.action,
      entityType: dto.entityType,
      entityId: dto.entityId,
      description: dto.description,
      timestamp: new Date(dto.timestampISO),
    });
  }
}