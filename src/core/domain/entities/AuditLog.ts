export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE';
export type AuditEntityType = 'TRANSACTION' | 'CATEGORY' | 'WEEKLY_CYCLE' | 'SYSTEM';

export interface AuditLogProps {
  id: string;
  action: AuditAction;
  entityType: AuditEntityType | string;
  entityId: string;
  description: string;
  timestamp?: Date;
}

export class AuditLog {
  private readonly _id: string;
  private readonly _action: AuditAction;
  private readonly _entityType: string;
  private readonly _entityId: string;
  private readonly _description: string;
  private readonly _timestamp: Date;

  public constructor(props: AuditLogProps) {
    if (!props.id || !props.id.trim()) {
      throw new Error('ID nhật ký (AuditLog.id) không được để trống.');
    }
    if (!props.entityType || !props.entityType.trim()) {
      throw new Error('Loại thực thể (AuditLog.entityType) không được để trống.');
    }
    if (!props.entityId || !props.entityId.trim()) {
      throw new Error('ID thực thể (AuditLog.entityId) không được để trống.');
    }
    if (!props.description || !props.description.trim()) {
      throw new Error('Mô tả nhật ký (AuditLog.description) không được để trống.');
    }

    const validtimestamp = props.timestamp ?? new Date();
    if (!(validtimestamp instanceof Date) || Number.isNaN(validtimestamp.getTime())) {
      throw new Error('Thời gian nhật ký (AuditLog.timestamp) không hợp lệ.');
    }

    this._id = props.id.trim();
    this._action = props.action;
    this._entityType = props.entityType.trim();
    this._entityId = props.entityId.trim();
    this._description = props.description.trim();
    this._timestamp = new Date(validtimestamp.getTime());
  }

  public static create(props: AuditLogProps): AuditLog {
    return new AuditLog(props);
  }

  public get id(): string {
    return this._id;
  }

  public get action(): AuditAction {
    return this._action;
  }

  public get entityType(): string {
    return this._entityType;
  }

  public get entityId(): string {
    return this._entityId;
  }

  public get description(): string {
    return this._description;
  }

  public get timestamp(): Date {
    return new Date(this._timestamp.getTime());
  }
}