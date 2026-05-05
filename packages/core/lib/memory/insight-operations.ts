/**
 * Insight Operations Module
 *
 * Handles discovery, storage, and retrieval of agent insights, preferences, and system patterns.
 * Supports hierarchical scoping for multi-tenant isolation.
 *
 * This module is now modularized into specialized sub-modules in the ./insights directory.
 */

export * from './insights/common';
export * from './insights/query-operations';
export * from './insights/management-operations';
export * from './insights/metabolic-operations';
