###############################################################################
# Makefile.quality: Linting, formatting, and type-checking (with fail-fast)
###############################################################################
include makefiles/Makefile.shared.mk

.PHONY: check gate gate-deploy gate-tier-1 gate-tier-2 gate-fast fix lint lint-fix format format-check type-check aiready aeo lint-staged build-integrations build-cli bundle-check docs-check security-scan

aeo: aiready docs-check ## Run all Agentic Engine Optimization (AEO) checks

bundle-check: ## [FAIL-FAST] Verify Lambda bundles contain critical dependencies
	@$(call log_step,Scanning Lambda bundles for critical dependencies...)
	@$(PNPM) exec tsx $(SCRIPTS_DIR)/quality/bundle-scanner.ts || { \
		$(call log_error,Bundle check failed - critical dependencies missing from Lambda zip); \
		exit 1; \
	}

build-integrations: ## Build all integration packages (@serverlessclaw/integration-*)
	@$(call log_step,Building integrations via Turbo...)
	@$(PNPM) exec turbo run build --filter="@serverlessclaw/integration-*"

build-cli: ## Build the CLI package (@serverlessclaw/cli)
	@$(call log_step,Building CLI via Turbo...)
	@$(PNPM) exec turbo run build --filter="@serverlessclaw/cli"

gate: ## Run all quality checks in parallel (via Turborepo) + E2E
	@$(call log_step,Running full quality gate in parallel via Turbo...)
	@$(PNPM) run gate
	@$(MAKE) bundle-check
	@$(MAKE) test-e2e

gate-tier-1: ## [FAIL-FAST #3/3] Fast Tier 1 checks (linting, formatting, types) - must pass before deployment
	@$(call log_step,[FAIL-FAST #3/3] Running Tier 1 (Fast) gate via Turbo...)
	@$(call log_info,Running: lint, format, type-check...)
	@$(PNPM) run check || { \
		$(call log_error,Tier 1 gate FAILED - fix lint/format/type errors and try again); \
		exit 1; \
	}
	@$(PNPM) exec aiready scan . || { \
		$(call log_warning,AIReady: Code organization can be optimized (scheduling post-deploy refactoring)); \
	}
	@$(MAKE) docs-check || { \
		$(call log_warning,Documentation check: scheduling post-deploy review); \
	}
	@$(MAKE) bundle-check || { \
		$(call log_warning,Bundle check: scheduling post-deploy verification); \
	}
	@$(call log_success,[FAIL-FAST #3/3] Tier 1 gate PASSED)

gate-tier-2: ## Thorough Tier 2 checks (tests, coverage, security, agentic optimization)
	@$(call log_step,Running Tier 2 (Thorough) gate...)
	@$(call log_info,Running: framework tests + integration checks...)
	@$(PNPM) run test || { \
		$(call log_error,Tier 2 gate FAILED - framework tests failed); \
		exit 1; \
	}
	@$(call log_success,Tier 2 gate PASSED)

gate-fast: ## Fast local gate (only affected packages + principles + aiready)
	@$(call log_step,Running fast local gate via Turbo...)
	@$(PNPM) exec turbo run check test aiready --filter="[origin/main]" $(TURBO_FLAGS)
	@$(MAKE) principles-check

principles-check: ## Verify architectural principles (P0/P1 issues)
	@$(call log_step,Verifying architectural principles...)
	@$(PNPM) run principles

gate-deploy: ## Pre-deploy gate (Tier 1 + aiready + e2e)
	@$(call log_step,Running deploy gate via Turbo...)
	@$(PNPM) exec turbo run check aiready
	@$(MAKE) test-e2e

check: check-tools ## Run all quality checks (via Turborepo)
	@$(call log_step,Running all quality checks via Turbo...)
	@$(call load_env); $(PNPM) run check
	@$(call log_success,Worktree is clean and of high quality)

fix: lint-fix format ## Run all auto-fixers (lint --fix, prettier)

lint: ## Run ESLint check
	@$(call log_info,Running ESLint via Turbo...)
	@$(call load_env); $(PNPM) run lint

lint-fix: ## Run ESLint with --fix
	@$(call log_info,Fixing lint issues via Turbo...)
	@$(call load_env); $(PNPM) run lint:fix

format: ## Run Prettier to format code
	@$(call log_info,Formatting code with Prettier...)
	@$(call load_env); $(PNPM) run format

format-check: ## Check if code is formatted with Prettier
	@$(call log_info,Checking formatting via Turbo...)
	@$(call load_env); $(PNPM) run format-check

lockfile-check: ## Check if pnpm-lock.yaml is in sync with package.json
	@$(call log_step,Verifying lockfile freshness...)
	@if git diff --quiet pnpm-lock.yaml; then \
		$(call log_success,Lockfile is in sync with package.json); \
	else \
		$(call log_error,pnpm-lock.yaml is out of sync. Run: pnpm install); \
		exit 1; \
	fi

type-check: ## Run TypeScript type checking
	@$(call log_info,Type checking via Turbo...)
	@$(call load_env); $(PNPM) run type-check

aiready: ## Run AIReady scan to evaluate agent-friendliness
	@$(call log_info,Running AIReady scan...)
	@$(PNPM) exec aiready scan .

lint-staged: ## Run lint-staged for partial checks
	@$(call log_info,Running lint-staged...)
	@$(PNPM) exec lint-staged
