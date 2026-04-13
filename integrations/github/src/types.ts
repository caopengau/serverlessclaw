import { z } from 'zod';

export enum AttachmentType {
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
  AUDIO = 'AUDIO',
  DOCUMENT = 'DOCUMENT',
  FILE = 'FILE',
}

export const AttachmentSchema = z
  .object({
    type: z.nativeEnum(AttachmentType),
    url: z.string().url().optional(),
    base64: z.string().optional(),
    name: z.string().optional(),
    mimeType: z.string().optional(),
  })
  .refine((attachment) => Boolean(attachment.url || attachment.base64), {
    message: 'Attachment must include either url or base64 payload',
  });

export type Attachment = z.infer<typeof AttachmentSchema>;

export const InboundMessageSchema = z.object({
  source: z.string(),
  userId: z.string(),
  sessionId: z.string(),
  workspaceId: z.string().optional(),
  text: z.string(),
  attachments: z.array(AttachmentSchema).default(() => []),
  metadata: z.record(z.string(), z.unknown()).default(() => ({})),
  timestamp: z.string().optional(),
});

export type InboundMessage = z.infer<typeof InboundMessageSchema>;

export interface InputAdapter {
  readonly source: string;
  readonly version: string;
  parse(raw: unknown): InboundMessage;
  processMedia?(message: InboundMessage): Promise<InboundMessage>;
}

export interface IssueTrackerAction {
  createIssue(options: {
    repo?: string;
    project?: string;
    title: string;
    body: string;
    labels?: string[];
  }): Promise<{ key?: string; number?: number; url: string }>;

  addComment(options: {
    repo?: string;
    issueNumber?: number;
    issueKey?: string;
    body: string;
  }): Promise<{ url: string }>;

  getIssue(options: { repo?: string; issueNumber?: number; issueKey?: string }): Promise<{
    title: string;
    body: string;
    state?: string;
    status?: string;
    labels?: string[];
  }>;
}
