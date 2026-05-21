/**
 * Dashboard-specific constants to improve AI signal clarity and maintainability
 */
import {
  AGENT_ERRORS,
  HTTP_STATUS as CORE_HTTP_STATUS,
  DYNAMO_KEYS as CORE_DYNAMO_KEYS,
  TRACE_TYPES as CORE_TRACE_TYPES,
  TRACE_STATUS as CORE_TRACE_STATUS,
  NODE_ICON as CORE_NODE_ICON,
} from '@claw/core/lib/constants';

export const HTTP_STATUS = CORE_HTTP_STATUS;
export const DYNAMO_KEYS = CORE_DYNAMO_KEYS;
export const TRACE_TYPES = CORE_TRACE_TYPES;
export const TRACE_STATUS = CORE_TRACE_STATUS;
export const NODE_ICON = CORE_NODE_ICON;
export { AGENT_ERRORS };

/** Canonical icons from Lucide library. Moved from core to dashboard. */
export const RESOURCE_ICON = {
  APP: 'Globe',
  BOT: 'Bot',
  BRAIN: 'Brain',
  BUS: 'MessageCircle',
  DATABASE: 'Database',
  DASHBOARD: 'LayoutDashboard',
  HAMMER: 'Hammer',
  RADIO: 'Radio',
  SEND: 'Send',
  SIGNAL: 'Zap',
  STETHOSCOPE: 'Activity',
  ZAP: 'Zap',
  CODE: 'Code',
  SEARCH: 'Search',
  QA: 'FlaskConical',
  GEAR: 'Settings2',
  BELL: 'Bell',
  CALENDAR: 'Calendar',
} as const;

export const AUTH = {
  COOKIE_NAME: 'claw_auth_session',
  COOKIE_VALUE: 'authenticated',
  SESSION_USER_ID: 'claw_session_id',
  COOKIE_MAX_AGE: 60 * 60 * 24 * 7, // 1 week
  ERROR_INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  ERROR_SYSTEM_FAILURE: 'SYSTEM_FAILURE',
} as const;

export const API_ROUTES = {
  WEBHOOK: '/webhook',
  HEALTH: '/health',
  AGENTS: '/api/agents',
  CHAT: '/api/chat',
  MEMORY_PRIORITIZE: '/api/memory/prioritize',
  MEMORY_STATUS: '/api/memory/status',
  INFRASTRUCTURE: '/api/infrastructure',
} as const;

export const UI_STRINGS = {
  DASHBOARD_TITLE: 'DASHBOARD_TITLE',
  APP_LOGO: process.env.NEXT_PUBLIC_APP_LOGO || '/icon.png',
  APP_LOGO_BANNER: process.env.NEXT_PUBLIC_APP_LOGO_BANNER || '',
  MISSING_MESSAGE: 'Missing message',
  API_CHAT_ERROR: 'API Chat Error:',
  TRACE_NOT_FOUND: 'TRACE_NOT_FOUND',
  RETURN_TO_BASE: 'RETURN_TO_BASE',
  BACK_TO_INTELLIGENCE: 'BACK_TO_INTELLIGENCE',
  NEURAL_PATH_VISUALIZER: 'NEURAL_PATH_VISUALIZER',
  EXECUTION_TIMELINE: 'EXECUTION_TIMELINE',
  RAW_PAYLOAD: 'RAW_PAYLOAD',
  FINAL_OUTPUT: 'FINAL_OUTPUT',
  INTELLIGENCE_HEADER: 'INTELLIGENCE_HEADER',
  EVOLUTION_HEADER: 'EVOLUTION_HEADER',
  INFRA_HEADER: 'INFRA_HEADER',
  OBSERVABILITY_HEADER: 'OBSERVABILITY_HEADER',
  GOVERNANCE_HEADER: 'GOVERNANCE_HEADER',
  CHAT_DIRECT: 'CHAT_DIRECT',
  TRACE_INTEL: 'TRACE_INTEL',
  EVOLUTION_PIPELINE: 'EVOLUTION_PIPELINE',
  AGENTS: 'AGENTS',
  MEMORY_RESERVE: 'MEMORY_RESERVE',
  CAPABILITIES: 'CAPABILITIES',
  SYSTEM_PULSE: 'SYSTEM_PULSE',
  SESSION_TRAFFIC: 'SESSION_TRAFFIC',
  CONFIG: 'CONFIG',
  SECURITY_MANIFEST: 'SECURITY_MANIFEST',
  SELF_HEALING: 'SELF_HEALING',
  SCHEDULING: 'SCHEDULING',
  COGNITIVE_HEALTH: 'COGNITIVE_HEALTH',
  OBSERVABILITY: 'OBSERVABILITY',
  WORKSPACES: 'WORKSPACES',
  CONSENSUS: 'CONSENSUS',
  TUNING: 'TUNING',
  NODE_STATUS: 'CORE_SYNC',
  SYSTEM_ONLINE: 'LINK_ESTABLISHED',
  SYSTEM_OFFLINE: 'LINK_INTERRUPTED',
} as const;

export const ROUTES = {
  HOME: '/',
  LANDING: '/',
  CHAT: '/chat',
  TRACE: '/trace',
  AGENTS: '/agents',
  MEMORY: '/memory',
  PIPELINE: '/pipeline',
  CAPABILITIES: '/capabilities',
  SYSTEM_PULSE: '/system-pulse',
  LOCKS: '/locks',
  SETTINGS: '/settings',
  SECURITY: '/security',
  RESILIENCE: '/resilience',
  SCHEDULING: '/scheduling',
  COGNITIVE_HEALTH: '/cognitive-health',
  OBSERVABILITY: '/observability',
  WORKSPACES: '/workspaces',
  COLLABORATION: '/collaboration',
  TUNING: '/tuning',
} as const;
