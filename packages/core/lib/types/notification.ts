import { Attachment } from './llm';

export enum NotificationType {
  SHARE_MESSAGE = 'SHARE_MESSAGE',
  SHARE_ASSET = 'SHARE_ASSET',
  SYSTEM_ALERT = 'SYSTEM_ALERT',
  MENTION = 'MENTION',
  CLARIFICATION = 'CLARIFICATION',
}

export enum NotificationStatus {
  UNREAD = 'unread',
  READ = 'read',
}

export enum ResourceType {
  MESSAGE = 'message',
  ASSET = 'asset',
  MISSION = 'mission',
  TASK = 'task',
}

export interface Notification {
  id: string;
  type: NotificationType;
  senderId: string;
  senderName: string;
  receiverId: string;
  workspaceId: string;
  sessionId?: string;
  resourceId?: string; // messageId or asset URL
  resourceType?: ResourceType;
  content: string; // Preview or note
  attachments?: Attachment[];
  status: NotificationStatus;
  timestamp: number;
  expiresAt: number;
}

export interface CreateNotificationParams {
  type: NotificationType;
  senderId: string;
  senderName: string;
  receiverId: string;
  workspaceId: string;
  sessionId?: string;
  resourceId?: string;
  resourceType?: ResourceType;
  content: string;
  attachments?: Attachment[];
}
