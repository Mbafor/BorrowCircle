export type ReportTargetType = 'ITEM' | 'USER';

export type ReportStatus = 'OPEN' | 'REVIEWED';

export interface Report {
  id: string;
  reporterId: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  note: string | null;
  status: ReportStatus;
  createdAt: string;
}
