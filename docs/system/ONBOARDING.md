# ServerlessClaw: Tenant & User Onboarding

This document describes the generic onboarding mechanisms for the **ServerlessClaw** framework, applicable to any multi-tenant agent swarm.

---

## 1. User & Workspace Onboarding

ServerlessClaw follows a multi-tenant isolation model (Silo 1) where users are grouped into **Workspaces**.

### 1.1 Organizational Structure

- **Organization**: Top-level entity for enterprise clients.
- **Workspace**: A logical partition for a specific set of assets and agents.
- **Team**: A subgroup within an organization.

### 1.2 User Lifecycle

1.  **Provisioning**: Admins create users via the **Users** dashboard page or `/api/users` endpoint.
2.  **Invitation**: Users are invited to specific workspaces via the **Workspaces** settings.
3.  **Authentication**: Handled via SST Auth with JWT-based session management.
4.  **Authorization**: Role-based access control (RBAC) enforced via `IdentityManager` (Owner, Admin, Member, Viewer).

### 1.3 Implementation Path

- **UI**: `framework/apps/dashboard/src/app/(dashboard)/users` and `workspaces`.
- **Backend**: `framework/packages/core/lib/memory/workspace-operations.ts` and `identity-manager.ts`.

---

## 2. Generic Resource Management

The framework supports a generic "Resources" (or "Assets") interface that can be extended by domain-specific plugins.

### 2.1 Resource Registration

- **Capability Discovery**: Agents discover available tools and resources via the MCP Multiplexer.
- **Plugin UI**: Domain-specific UI (like a Battery management view) should be registered as a Sidebar Extension via the `PluginManager`.

---

## 3. Recommended Enhancements (Framework Level)

| Feature                  | Description                                                          | Target                      |
| :----------------------- | :------------------------------------------------------------------- | :-------------------------- |
| **Guided Setup Wizard**  | A step-by-step UI for new tenants to set up their Org and Workspace. | `apps/dashboard/onboarding` |
| **Identity Marketplace** | Integration with external SSO providers (Okta, Entra ID).            | `packages/core/lib/auth`    |
