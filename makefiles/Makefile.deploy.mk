###############################################################################
# Makefile.deploy: Deployment and Infrastructure targets
###############################################################################
include makefiles/Makefile.shared.mk

LOCAL_STAGE ?= local

.PHONY: dev deploy diff synth remove remove-local clear-port

dev: ENV := local
dev: clear-port ## Start SST in development mode (mono mode)
	@$(call log_step,Starting SST dev mode on stage $(LOCAL_STAGE) in mono mode...)
	@$(call load_env); \
	unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN; \
	TERM=xterm $(SST) dev --stage $(LOCAL_STAGE)


deploy: ## Deploy SST to the environment (default: prod) - WITH FAIL-FAST CHECKS
	@if [ "$(ENV)" = "prod" ]; then \
		$(call log_warning,WARNING: Direct deployment to production is discouraged.); \
		$(call log_warning,Run 'make release' instead for full quality gates and auditing (tagging).); \
		sleep 2; \
	fi
	@$(call log_step,Preparing deployment for environment: $(ENV)...)
	@if [ ! -f "$(SST)" ]; then $(call log_error,SST binary not found. Run pnpm install first.); exit 1; fi
	@$(call load_env); \
	chmod +x ./$(SCRIPTS_DIR)/ci/check-aws-account.sh; \
	if \
		$(call log_info,[DEPLOY STEP 1/4] Verifying AWS account and permissions...) && \
		./$(SCRIPTS_DIR)/ci/check-aws-account.sh "$(ENV)" "$$EXPECTED_ACCOUNT" && \
		$(call log_success,[DEPLOY STEP 1/4] AWS account verified) && \
		$(call log_info,[DEPLOY STEP 2/4] Starting SST deployment...) && \
		$(SST) deploy --stage $(ENV) --yes && \
		$(call log_success,[DEPLOY STEP 2/4] SST deployment completed) && \
		$(call log_info,[DEPLOY STEP 3/4] Running post-deploy CloudFront fix...) && \
		APP_NAME=$$(jq -r .name package.json 2>/dev/null || echo 'serverlessclaw') && \
		$(call log_info,Resolved APP_NAME=$$APP_NAME from package.json) && \
		$(PNPM) exec tsx $(SCRIPTS_DIR)/quality/fix-cloudfront-deploy.ts $(ENV) $$APP_NAME MissionControl && \
		$(call log_success,[DEPLOY STEP 3/4] CloudFront configuration updated) && \
		$(call log_info,[DEPLOY STEP 4/4] Running post-deploy verification...) && \
		$(MAKE) verify-deploy && \
		$(call log_success,[DEPLOY STEP 4/4] Post-deploy verification passed); \
	then \
		if [ "$(E2E)" = "true" ]; then $(MAKE) test-tier-3 ; fi; \
		$(call log_success,SST deploy to $(ENV) completed successfully); \
	else \
		$(call log_error,SST deploy to $(ENV) failed); \
		$(call log_warning,If the failure was 'record already exists' or a state drift issue, run:); \
		$(call log_warning,  make heal ENV=$(ENV)); \
		exit 1; \
	fi

diff: ## Show SST infrastructure changes
	@$(call log_info,SST diff for $(ENV)...)
	@$(call load_env); $(SST) diff --stage $(ENV)

heal: ## Attempt to automatically fix Infrastructure as Code (IaC) state drift
	@$(call log_step,Attempting to reconcile IaC state for environment: $(ENV)...)
	@$(call log_warning,This will query actual AWS/Cloudflare resources and update the local state file.)
	@$(call load_env); $(SST) refresh --stage $(ENV)
	@$(call log_success,State reconciliation complete. You can now retry the deployment.)

synth: ## Synthesize SST resources (mapped to sst diff in v4)
	@$(call log_info,Validating SST resources for $(ENV)...)
	@$(call load_env); $(SST) diff --stage $(ENV)

remove: ## Remove SST resources for the specified environment
	@$(call log_warning,WARNING: Removing SST resources for stage $(ENV)!)
	@$(call load_env); $(SST) remove --stage $(ENV) --yes
remove-local: ## Remove SST resources for the local development stage
	@$(MAKE) remove ENV=$(LOCAL_STAGE)

clear-port: ## Clear common dev port
	@$(call kill_port,7777)
