###############################################################################
# Makefile.shared: Common macros, variables, and environment configuration
###############################################################################

ifndef _SHARED_MK_INCLUDED
_SHARED_MK_INCLUDED := 1

# Explicitly use bash for all shell commands to ensure macro robustness
SHELL := /bin/bash

# Ensure Node.js and workspace binaries are in the path
ROOT_DIR := $(shell git rev-parse --show-toplevel 2>/dev/null || pwd)
export PATH := $(ROOT_DIR)/node_modules/.bin:/Users/pengcao/.nvm/versions/node/v24.15.0/bin:$(PATH)

# Colors
RED        := $(shell printf '\033[0;31m')
GREEN      := $(shell printf '\033[0;32m')
YELLOW     := $(shell printf '\033[0;33m')
BLUE       := $(shell printf '\033[0;34m')
LIGHTBLUE  := $(shell printf '\033[1;34m')
CYAN       := $(shell printf '\033[0;36m')
MAGENTA    := $(shell printf '\033[0;35m')
RESET      := $(shell printf '\033[0m')
BOLD       := $(shell printf '\033[1m')

# Dynamically resolve package manager
PNPM := $(shell command -v pnpm 2>/dev/null || echo npm)

# Use the workspace-local SST binary for deterministic behavior.
# Prerequisite: run `pnpm install` so this binary exists.
SST := ./node_modules/.bin/sst

# Detect scripts directory (subtree aware)
SCRIPTS_DIR := $(shell if [ -f "scripts/ci/check-aws-account.sh" ]; then echo "scripts"; else echo "framework/scripts"; fi)

# Logging macros
define log_info
	printf '$(CYAN)[INFO] %s$(RESET)\n' "$(1)"
endef

define log_success
	printf '$(GREEN)[SUCCESS] %s$(RESET)\n' "$(1)"
endef

define log_warning
	printf '$(YELLOW)[WARNING] %s$(RESET)\n' "$(1)"
endef

define log_error
	printf '$(RED)[ERROR] %s$(RESET)\n' "$(1)"
endef

define log_step
	printf '$(LIGHTBLUE)[STEP] %s$(RESET)\n' "$(1)"
endef

define separator
	printf '%s$(BOLD)================================================================================$(RESET)\n' "$(1)"
endef

# Environment handling (3-tier: local, dev, or prod)
ENV ?= dev
AWS_REGION ?= ap-southeast-2

# Parallelism
PARALLELISM ?= $(shell sysctl -n hw.ncpu 2>/dev/null || nproc 2>/dev/null || echo 4)
ifneq ($(filter -j% -j,$(MAKEFLAGS)),)
	MAKE_PARALLEL :=
else
	MAKE_PARALLEL := -j$(PARALLELISM)
endif

# Environment file resolution
# .env.local: local development secrets
# .env.dev: development environment configuration
# .env.prod: production environment configuration
ENV_FILES = .env.$(ENV)

# Usage: $(call load_env)
# Loads available env files and exports variables.
# In CI (CodeBuild), AWS credentials come from the service role — AWS_PROFILE is unset.
# In local/dev/prod, AWS_PROFILE should be set in the respective .env file.
define load_env
	@if [ -f "$$HOME/.nvm/nvm.sh" ]; then \
		export NVM_DIR="$$HOME/.nvm" && . "$$HOME/.nvm/nvm.sh" && nvm use --silent 2>/dev/null || true; \
	fi; \
	if ! command -v node >/dev/null 2>&1; then \
		$(call log_error,Node.js not found in PATH. Please ensure Node.js is installed and in your PATH.); \
		exit 1; \
	fi; \
	if [[ $$(node -v) != v24.* ]]; then \
		$(call log_warning,Node.js 24 is recommended (detected $$(node -v)). If deployment fails, please switch to Node 24.); \
	fi; \
	if [ ! -f "$(ENV_FILES)" ]; then \
		if [ "$(ENV)" == "local" ] && [ -f ".env.dev" ]; then \
			$(call log_warning,Environment file .env.local not found. Falling back to .env.dev...); \
			set -a; . ./.env.dev; set +a; \
		else \
			$(call log_error,Environment file $(ENV_FILES) not found.); \
			exit 1; \
		fi; \
	else \
		$(call log_info,Loading env file: $(ENV_FILES)); \
		set -a; . ./$(ENV_FILES); set +a; \
	fi; \
	if [ -n "$$AWS_PROFILE" ]; then \
		if [ -n "$$AWS_ACCESS_KEY_ID" ] || [ -n "$$AWS_SECRET_ACCESS_KEY" ]; then \
			$(call log_warning,Multiple AWS credential sources detected (PROFILE and static keys). Unsetting static keys to favor PROFILE.); \
			unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN; \
			export AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN; \
		fi; \
	fi; \
	if [ "$(ENV)" = "local" ]; then \
		$(call log_info,Local dev — using AWS_PROFILE: $$AWS_PROFILE for initial authentication); \
	elif [ -n "$$CODEBUILD_BUILD_ID" ]; then \
		unset AWS_PROFILE; \
		$(call log_info,CI environment detected — using service role credentials); \
	elif [ -z "$$AWS_PROFILE" ]; then \
		$(call log_error,AWS_PROFILE is not set in $(ENV_FILES).); \
		exit 1; \
	fi; \
	if { [ "$(ENV)" = "prod" ] || [ "$(ENV)" = "dev" ]; } && [ -z "$$EXPECTED_ACCOUNT" ]; then \
		$(call log_error,EXPECTED_ACCOUNT is not set for stage $(ENV) in $(ENV_FILES).); \
		exit 1; \
	fi
endef

check-tools: ## Verify that required tools (node, pnpm) are installed and in PATH
	@$(call log_step,Verifying environment tools...)
	@command -v node >/dev/null 2>&1 || { $(call log_error,Node.js is missing); exit 1; }
	@command -v pnpm >/dev/null 2>&1 || { $(call log_error,pnpm is missing); exit 1; }
	@$(call log_success,All required tools (node, pnpm) are available.)

.PHONY: show-env verify-up-to-date verify-framework-sync pull sync sync-downstream sync-upstream sync-status

verify-up-to-date: ## Verify local branch is up to date with remote
	@$(call verify_up_to_date)

verify-framework-sync: ## [AI-GUARD] Check if framework subtree needs a sync from official upstream
	@$(call log_step,Checking for framework updates from official upstream...); \
	git fetch $(SUBTREE_OFFICIAL_REMOTE) $(SUBTREE_BRANCH) --quiet 2>/dev/null || true; \
	BEHIND=$$(git rev-list --count HEAD..$(SUBTREE_OFFICIAL_REMOTE)/$(SUBTREE_BRANCH) -- framework/ 2>/dev/null || echo 0); \
	if [ "$$BEHIND" -gt 0 ]; then \
		$(call log_warning,Framework is behind official upstream by $$BEHIND commits. Consider running 'make f-sync-down'.); \
	else \
		$(call log_success,Framework is in sync with official upstream.); \
	fi

# --- SYNC ---
# Repo boundary policy:
# - product is the primary repo (origin)
# - framework is a subtree sourced from serverlessclaw
# - official serverlessclaw remote is fetch-only in product by default
SUBTREE_OFFICIAL_REMOTE ?= upstream-origin
SUBTREE_BRANCH ?= main

pull: ## Pull latest origin branch, then pull latest official framework subtree
	@$(call log_step,Pulling latest changes from origin...)
	@git pull origin $$(git rev-parse --abbrev-ref HEAD)
	@$(MAKE) sync-downstream

sync: ## Push product to origin only (safe default)
	@$(call log_step,Pushing latest changes to origin...)
	@git push origin $$(git rev-parse --abbrev-ref HEAD)

sync-status: ## Show sync remote safety status and commit/file differences
	@$(call log_step,Checking subtree remote safety and sync status...); \
	echo "origin (push):       $$(git remote get-url --push origin 2>/dev/null || echo 'N/A')" ; \
	echo "$(SUBTREE_OFFICIAL_REMOTE) (fetch): $$(git remote get-url $(SUBTREE_OFFICIAL_REMOTE) 2>/dev/null || echo 'N/A')" ; \
	echo "$(SUBTREE_OFFICIAL_REMOTE) (push):  $$(git remote get-url --push $(SUBTREE_OFFICIAL_REMOTE) 2>/dev/null || echo 'N/A')" ; \
	echo "upstream-local (push): $$(git remote get-url --push upstream-local 2>/dev/null || echo 'N/A')" ; \
	\
	REMOTE=$$(git remote | grep -q "^upstream-local$$" && echo "upstream-local" || echo "$(SUBTREE_OFFICIAL_REMOTE)"); \
	git fetch $$REMOTE $(SUBTREE_BRANCH) --quiet 2>/dev/null || true; \
	\
	DIFF_FILES=$$(git diff $$REMOTE/$(SUBTREE_BRANCH) --name-only -- framework/ 2>/dev/null | wc -l | tr -d ' '); \
	AHEAD=$$(git rev-list --count $$REMOTE/$(SUBTREE_BRANCH)..HEAD -- framework/ 2>/dev/null || echo 0); \
	\
	if [ "$$DIFF_FILES" -gt 0 ]; then \
		$(call log_warning,Found $$DIFF_FILES modified files in framework/ compared to $$REMOTE); \
	else \
		$(call log_success,Framework files are in sync with $$REMOTE); \
	fi; \
	if [ "$$AHEAD" -gt 0 ]; then \
		$(call log_info,VoltX is ahead of $$REMOTE by $$AHEAD commits in framework/); \
	fi

sync-downstream: ## Pull latest framework subtree (Remote: SUBTREE_OFFICIAL_REMOTE or SYNC_DOWNSTREAM_REMOTE)
	@REMOTE=$(or $(SYNC_DOWNSTREAM_REMOTE),$(SUBTREE_OFFICIAL_REMOTE)); \
	$(call log_step,Syncing framework subtree from $$REMOTE/$(SUBTREE_BRANCH)...); \
	git fetch $$REMOTE $(SUBTREE_BRANCH); \
	GIT_EDITOR=true git subtree pull --prefix=framework $$REMOTE $(SUBTREE_BRANCH) --squash
	@$(call log_success,Framework subtree synced.)

sync-upstream: ## Run framework quality gates and promote subtree to upstream (required: SYNC_UPSTREAM_REMOTE)
	@$(call log_step,Preparing framework subtree promotion...)
	@if [ -z "$(SYNC_UPSTREAM_REMOTE)" ]; then \
		$(call log_error,SYNC_UPSTREAM_REMOTE is required. Example: make sync-upstream SYNC_UPSTREAM_REMOTE=upstream-local); \
		exit 1; \
	fi
	@if [ "$$(git remote get-url --push $(SYNC_UPSTREAM_REMOTE) 2>/dev/null || echo 'MISSING')" = "DISABLED" ]; then \
		$(call log_error,Push remote $(SYNC_UPSTREAM_REMOTE) is DISABLED. Enable intentionally before pushing subtree.); \
		exit 1; \
	fi
	@$(call verify_clean)
	@$(call log_step,Step 1/3: Updating framework lockfile (OSS purity)...)
	@cd framework && $(PNPM) install --lockfile-only --ignore-workspace >/dev/null 2>&1 || true
	@if [ -n "$$(git status --porcelain framework/pnpm-lock.yaml)" ]; then \
		$(call log_info,Lockfile was outdated. Committing updated framework lockfile...); \
		git add framework/pnpm-lock.yaml; \
		git commit -m "chore: synchronize framework lockfile for OSS purity"; \
	fi
	@$(call log_step,Step 2/3: Running framework quality gates...)
	@$(MAKE) -C framework pre-push VERIFY_REMOTE=$(SYNC_UPSTREAM_REMOTE) SKIP_VERIFY=1
	@$(call log_step,Step 3/3: Pushing framework subtree to $(SYNC_UPSTREAM_REMOTE)/$(SUBTREE_BRANCH)...)
	@git subtree push --prefix=framework $(SYNC_UPSTREAM_REMOTE) $(SUBTREE_BRANCH)
	@$(call log_success,Framework subtree successfully promoted to $(SYNC_UPSTREAM_REMOTE)/$(SUBTREE_BRANCH).)

framework-sync: ## [DEPRECATED] Use sync-upstream or sync-downstream instead
	@$(call log_warning,framework-sync is deprecated. Delegating to sync targets...); \
	if [ "$(CMD)" = "up" ]; then \
		$(MAKE) sync-upstream SYNC_UPSTREAM_REMOTE=upstream-local; \
	elif [ "$(CMD)" = "down" ]; then \
		$(MAKE) sync-downstream SYNC_DOWNSTREAM_REMOTE=upstream-local; \
	else \
		$(MAKE) sync-status; \
	fi

show-env: ## Show current environment variables (filtered)
	@$(call load_env); \
	$(call log_info,Current Environment Settings (Loaded from files):); \
	env | grep -E "^(SST_|AWS_|TELEGRAM_|OPENAI_|GITHUB_|EXPECTED_ACCOUNT)" | sort || true

# Common track_time macro
define track_time
	start=$$(date +%s); \
	eval $(1); \
	status=$$?; \
	end=$$(date +%s); \
	elapsed=$$((end - start)); \
	if [ $$status -eq 0 ]; then \
		printf '$(GREEN)✅ %s completed in %ss$(RESET)\n' "$(2)" "$$elapsed"; \
	else \
		printf '$(RED)❌ %s failed after %ss$(RESET)\n' "$(2)" "$$elapsed"; \
	fi; \
	exit $$status
endef

.PHONY: telegram-setup telegram-info telegram-delete

telegram-setup: ## Set Telegram webhook to current API_URL (local or prod)
	@$(call log_step,Setting Telegram webhook for $(ENV)...)
	@chmod +x ./scripts/ci/telegram-webhook.sh
	@ENV_UPPER=$$(echo $(ENV) | tr '[:lower:]' '[:upper:]'); \
	URL=$$(grep "^$${ENV_UPPER}_API_URL=" .env | cut -d '=' -f2)/webhook; \
	if [ -z "$$URL" ] || [ "$$URL" = "/webhook" ]; then \
		$(call log_error,Could not find $${ENV_UPPER}_API_URL in .env (ENV=$(ENV)). Check that it's defined.); \
		exit 1; \
	fi; \
	./scripts/ci/telegram-webhook.sh set "$$URL"

telegram-info: ## Get current Telegram webhook status
	@$(call log_info,Fetching Telegram webhook status...)
	@chmod +x ./scripts/ci/telegram-webhook.sh
	@./scripts/ci/telegram-webhook.sh get

telegram-delete: ## Delete current Telegram webhook
	@$(call log_warning,Deleting Telegram webhook!)
	@chmod +x ./scripts/ci/telegram-webhook.sh
	@./scripts/ci/telegram-webhook.sh delete

# Usage: $(call verify_clean)
# Fails if there are uncommitted or untracked changes
define verify_clean
	if [ -n "$$(git status --porcelain)" ]; then \
		$(call log_error,Git working directory is not clean. Commit or stash changes before proceeding.); \
		git status; \
		exit 1; \
	fi; \
	$(call log_success,Working directory is clean.)
endef

# kill_port
# usage: $(call kill_port,8888)
define kill_port
	@lsof -ti :$(1) >/dev/null 2>&1 && lsof -ti :$(1) | xargs kill -9 || true
	@sleep 1
	@$(call log_success,Port $(1) is now free)
endef

# Usage: $(call run_parallel_gate,NAME~CMD||NAME~CMD||...)
# Runs all checks in background, prints consolidated summary, exits non-zero if any failed.
# Entries separated by ||, each entry is NAME~COMMAND where ~ separates display name from command.
# Example: $(call run_parallel_gate,lint~make lint||format~make format-check)
define run_parallel_gate
	gate_tmp=$$(mktemp -d); \
	trap 'rm -rf "$$gate_tmp"' EXIT; \
	IFS=$$'\n' gate_checks=($$(echo "$(1)" | sed 's/||/\n/g')); \
       for entry in "$${gate_checks[@]}"; do \
               [ -z "$$entry" ] && continue; \
               name=$$(echo "$$entry" | cut -d'~' -f1); \
               cmd=$$(echo "$$entry" | cut -d'~' -f2-); \
               ( \
                       eval $$cmd > "$$gate_tmp/$$name.out" 2>&1; \
                       echo $$? > "$$gate_tmp/$$name.exit" \
               ) & \
       done; \
       wait; \
       gate_failed=0; gate_total=0; \
       printf '\n%s\n' "========================================="; \
       printf '  %s\n' "QUALITY GATE SUMMARY"; \
       printf '%s\n\n' "========================================="; \
       for entry in "$${gate_checks[@]}"; do \
               [ -z "$$entry" ] && continue; \
               name=$$(echo "$$entry" | cut -d'~' -f1); \
               gate_total=$$((gate_total + 1)); \
               code=$$(cat "$$gate_tmp/$$name.exit" 2>/dev/null || echo "1"); \
               if [ "$$code" = "0" ]; then \
                       printf '  \033[0;32m✅ %-20s PASSED\033[0m\n' "$$name"; \
               else \
                       printf '  \033[0;31m❌ %-20s FAILED (exit %s)\033[0m\n' "$$name" "$$code"; \
                       gate_failed=$$((gate_failed + 1)); \
                       printf '    --- output (last 20 lines) ---\n'; \
                       [ -f "$$gate_tmp/$$name.out" ] && sed 's/^/    /' "$$gate_tmp/$$name.out" | tail -20 || echo "    (no output found)"; \
                       printf '    ------------------------------\n'; \
               fi; \
       done; \
       printf '\n  Result: %d/%d passed\n' "$$((gate_total - gate_failed))" "$$gate_total"; \
       if [ "$$gate_failed" -gt 0 ]; then \
               printf '  \033[0;31m❌ GATE FAILED\033[0m\n\n'; \
               exit 1; \
       else \
               printf '  \033[0;32m✅ GATE PASSED\033[0m\n\n'; \
               exit 0; \
       fi
endef

# Usage: $(call verify_env,VAR1 VAR2)
# Fails if any of the provided variables are empty.
define verify_env
	for var in $(1); do \
		eval value=\$$$$var; \
		if [ -z "$$value" ]; then \
			$(call log_error,Required environment variable $$var is missing.); \
			exit 1; \
		fi; \
	done
endef

# Usage: $(call verify_up_to_date)
# Fetches remote and verifies local branch is not behind or diverged. Use before push in trunk-based dev.
VERIFY_REMOTE ?= origin
define verify_up_to_date
       current=$$(git rev-parse --abbrev-ref HEAD); \
       if [ "$$current" = "HEAD" ]; then \
               $(call log_error,Detached HEAD detected. Push to a branch instead.); \
               exit 1; \
       fi; \
       if ! git remote | grep -qE "^$(VERIFY_REMOTE)([[:space:]]|$$)"; then \
               $(call log_warning,No '$(VERIFY_REMOTE)' remote found. Skipping up-to-date check.); \
       else \
               $(call log_info,Verifying connectivity to $(VERIFY_REMOTE)...); \
               git fetch $(VERIFY_REMOTE) "$$current" --quiet --dry-run --timeout=10 2>/dev/null || true; \
               local_rev=$$(git rev-parse HEAD); \
               remote_rev=$$(git rev-parse "$(VERIFY_REMOTE)/$$current" 2>/dev/null || echo ""); \
               if [ -n "$$remote_rev" ]; then \
                       merge_base=$$(git merge-base HEAD "$(VERIFY_REMOTE)/$$current" 2>/dev/null || echo ""); \
                       if [ "$$merge_base" != "$$remote_rev" ]; then \
                               if [ "$$merge_base" = "$$local_rev" ]; then \
                                       $(call log_error,Local branch is behind $(VERIFY_REMOTE)/$$current. Run: git pull --rebase); \
                               else \
                                       $(call log_error,Local branch has diverged from $(VERIFY_REMOTE)/$$current. Rebase first.); \
                               fi; \
                               exit 1; \
                       fi; \
               fi; \
               $(call log_success,Branch is up to date with $(VERIFY_REMOTE)); \
       fi
endef

.PHONY: manifest clean-ddb seed-e2e

clean-ddb: ## Clean up temporary E2E/test data from DynamoDB
	@$(call log_step,Cleaning DynamoDB test data for $(ENV)...)
	@$(call load_env); $(SST) shell --stage $(ENV) -- npx tsx $(SCRIPTS_DIR)/dev/clean-ddb.ts

seed-e2e: ## Seed DynamoDB with data for E2E tests
	@$(call log_step,Seeding DynamoDB for E2E tests in $(ENV)...)
	@$(call load_env); $(SST) shell --stage $(ENV) -- npx tsx $(SCRIPTS_DIR)/dev/seed-e2e.ts

manifest: ## Generate a failure manifest from CI logs (LOG_DIR, OUTPUT_DIR)
	@$(call log_step,Generating failure manifest...)
	@LOG_DIR=$(or $(LOG_DIR),/tmp/ci-logs); \
	OUTPUT_DIR=$(or $(OUTPUT_DIR),.); \
	pnpm exec tsx scripts/ci/generate-manifest.ts "$$LOG_DIR" "$$OUTPUT_DIR"

.PHONY: clean clean-all

clean: ## Remove temporary build and test artifacts (.turbo, .next, .sst, coverage)
	@$(call log_step,Cleaning temporary artifacts...)
	@rm -rf .turbo .sst/artifacts coverage test-results
	@find . -name ".aiready" -type d -prune -exec rm -rf {} +
	@find . -name ".next" -type d -prune -exec rm -rf {} +
	@$(call log_success,Cleaned build artifacts.)

clean-all: clean ## Remove all artifacts including node_modules and pnpm store pruning
	@$(call log_step,Deep cleaning repository...)
	@rm -rf node_modules .sst
	@find . -name "node_modules" -type d -prune -exec rm -rf {} +
	@pnpm store prune
	@$(call log_success,Deep clean completed. Run 'pnpm install' to restore dependencies.)

endif
