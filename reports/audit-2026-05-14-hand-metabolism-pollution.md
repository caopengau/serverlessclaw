# Audit Report: Domain Pollution & Dashboard Isolation (2026-05-14)

## Status: REMEDIATED ✅

## Overview

This audit focused on **Anti-Pattern 20 (Domain Pollution)** in the core framework and **Principle 11 (Multi-tenant Isolation)** in the dashboard pages and additional API routes.

## Findings

### P1: Domain Pollution in Core Framework

- **Issue**: Several core framework files contained hardcoded product names (`ServerlessClaw`, `SuperClaw`) and repository URLs.
- **Remediation**:
  - Replaced `ServerlessClaw` with generic terms like `Framework` or `FrameworkCore` in metrics and MCP identification.
  - Updated `OpenRouter` provider to use configurable referer and title.
  - Changed default agent name from `SuperClaw` to `System Orchestrator` in `backbone.ts` and context templates.
  - Replaced hardcoded repository URL in system constants with a configurable environment variable.

### P1: Multi-Tenant Data Leakage in Dashboard Pages

- **Affected Areas**:
  - `apps/dashboard/src/app/(dashboard)/trace/page.tsx` (getSessionTitles)
  - `apps/dashboard/src/app/(dashboard)/memory/page.tsx` (getMemoryData / fallback discovery)
  - `apps/dashboard/src/app/api/infra/sync-status/route.ts`
- **Issue**: These areas were performing global scans or unscoped queries to retrieve session titles, memory types, and build status, potentially exposing data across tenants.
- **Remediation**:
  - Implemented `workspaceId` filtering in all affected `ScanCommand` and `listByPrefix` calls.
  - Passed `workspaceId` context from server component `searchParams` down to data fetching functions.

### P2: Infrastructure Logic Branded

- **Issue**: Infrastructure resources (SNS topics, Dashboard Nextjs resource) used product-specific display names.
- **Remediation**: Updated `packages/infra/billing.ts` and `packages/infra/dashboard.ts` to use generic resource names (`System Billing Alerts`, `MissionControl`).

## Verification

- Verified code changes for domain pollution in `packages/core`.
- Confirmed that dashboard pages now correctly scope data retrieval by `workspaceId`.
- Principles verification script already covers unscoped `listByPrefix` in dashboard APIs.

## Coverage Update

- **Silos**: Hand (2), Metabolism (7), Eye (5)
- **Perspectives**: G (Dashboard Integrity), B (Evolution Cycle)
- **Status**: Framework hardened against domain pollution; Dashboard isolation complete.

---

**Auditor**: Gemini CLI (Auto-Edit Mode)
**Date**: 2026-05-14
