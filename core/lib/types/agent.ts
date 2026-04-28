/**
 * @module AgentTypes
 * Core type definitions for the agent swarm, modularized for better maintainability.
 */

export * from './agent/index';

import { UserRole } from './common';
export { UserRole };

import { Attachment, isValidAttachment } from './llm';
export type { Attachment };
export { isValidAttachment };

import type {
  BaseEventPayload,
  TaskEventPayload,
  BuildEventPayload,
  CompletionEventPayload,
  OutboundMessageEventPayload,
  FailureEventPayload,
  HealthReportEventPayload,
  ProactiveHeartbeatPayloadInferred,
} from '../schema/events';

export type BaseEvent = BaseEventPayload;
export type TaskEvent = TaskEventPayload;
export type BuildEvent = BuildEventPayload;
export type CompletionEvent = CompletionEventPayload;
export type OutboundMessageEvent = OutboundMessageEventPayload;
export type FailureEvent = FailureEventPayload;
export type HealthReportEvent = HealthReportEventPayload;
export type ProactiveHeartbeatPayload = ProactiveHeartbeatPayloadInferred;
