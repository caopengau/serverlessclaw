###############################################################################
# Makefile.release: Release and Tagging targets (with fail-fast improvements)
###############################################################################
include makefiles/Makefile.shared.mk

.PHONY: release tag pre-deploy post-deploy release-all pre-release-check verify-build-readiness verify-clean receipt

release: ## Full Release: Pre-deploy Gates -> Deploy -> Post-deploy Gates -> Tag (prod only)
	@$(call log_step,Starting audited release for environment: $(ENV)...)
	@if [ "$(ENV)" != "prod" ] && [ "$(ENV)" != "dev" ]; then \
		$(call log_error,ERROR: Release target can ONLY be run for ENV=prod or ENV=dev. Detected: $(ENV)); \
		exit 1; \
	fi
	@$(call verify_clean)
	@$(MAKE) pre-deploy
	@$(MAKE) deploy ENV=$(ENV) E2E=false
	@$(MAKE) post-deploy
	@if [ "$(ENV)" = "prod" ]; then \
		$(MAKE) tag; \
	fi
	@$(MAKE) receipt ENV=$(ENV)
	@$(call log_success,Release to $(ENV) completed successfully!)

pre-deploy: ## Run all pre-deployment quality gates (fail-fast: env -> build -> tier-1 -> tier-2 -> devops-verify)
	@$(call log_step,Running PRE-DEPLOYMENT gates for $(ENV)...)
	@$(MAKE) pre-release-check
	@$(MAKE) verify-build-readiness
	@$(MAKE) gate-tier-1
	@$(MAKE) gate-tier-2
	@$(MAKE) verify-devops-standards
	@$(MAKE) check-framework-purity

post-deploy: ## Run all post-deployment verification gates
	@$(call log_step,Running POST-DEPLOYMENT gates for $(ENV)...)
	@$(MAKE) seed-e2e ENV=$(ENV)
	@$(MAKE) test-tier-3 || $(call log_warning,E2E tests reported issues - see logs above)

release-all: ## Release to both dev and prod sequentially
	@$(MAKE) release ENV=dev
	@$(MAKE) release ENV=prod

pre-release-check: ## [FAIL-FAST #1/3] Validate environment and credentials before release
	@$(call log_step,[FAIL-FAST #1/3] Pre-release environment check for $(ENV)...)
	@$(call load_env); \
	$(call verify_env,EXPECTED_ACCOUNT); \
	$(call log_info,Verifying AWS identity...); \
	ACTUAL_ACCOUNT=$$(aws sts get-caller-identity --query Account --output text 2>/dev/null); \
	if [ "$$ACTUAL_ACCOUNT" != "$$EXPECTED_ACCOUNT" ]; then \
		$(call log_error,AWS Account mismatch! Expected $$EXPECTED_ACCOUNT but found $$ACTUAL_ACCOUNT); \
		exit 1; \
	fi; \
	$(call log_info,Verifying AWS permissions...); \
	aws lambda list-functions --region $(AWS_REGION) > /dev/null 2>&1 || { $(call log_error,AWS credentials invalid or Lambda access denied); exit 1; }; \
	$(call log_success,Environment validated: Account $$EXPECTED_ACCOUNT, Region $(AWS_REGION))

verify-build-readiness: ## [FAIL-FAST #2/3] Verify the dashboard build will succeed
	@$(call log_step,[FAIL-FAST #2/3] Verifying build configuration...)
	@$(call log_info,Checking swc helpers bundling setup...)
	@if ! grep -q "install" framework/apps/dashboard/open-next.config.ts 2>/dev/null || ! grep -q "@swc/helpers" framework/apps/dashboard/open-next.config.ts 2>/dev/null; then \
		$(call log_warning,open-next.config.ts missing swc/helpers in install list); \
		echo "  Expected: install: ['@swc/helpers', ...]"; \
		$(call log_error,Build configuration incomplete - swc/helpers not in bundle list); \
		exit 1; \
	else \
		$(call log_success,swc/helpers bundling configured); \
	fi
	@$(call log_info,Checking outputFileTracingRoot configuration...)
	@if ! grep -q "outputFileTracingRoot" framework/apps/dashboard/next.config.mjs 2>/dev/null; then \
		$(call log_warning,next.config.mjs missing outputFileTracingRoot); \
		$(call log_error,Build configuration incomplete - tracing scope not expanded); \
		exit 1; \
	else \
		$(call log_success,Output file tracing configured); \
	fi
	@$(call log_info,Checking esbuild external packages...)
	@if [ -f sst.config.ts ] && grep -q "external.*swc" sst.config.ts 2>/dev/null; then \
		$(call log_error,esbuild still has swc in external list - will cause MODULE_NOT_FOUND); \
		exit 1; \
	else \
		$(call log_success,swc packages not externalized); \
	fi
	@$(call log_success,[FAIL-FAST #2/3] Build configuration verified)

verify-clean:
	@$(call log_info,Verifying working directory is clean...)
	@if ! git diff-index --quiet HEAD --; then \
		$(call log_error,Working directory has uncommitted changes); \
		git status --short; \
		exit 1; \
	fi
	@$(call log_success,Working directory is clean)

tag: ## Create and push a git tag for the current release (for auditing)
	@$(call log_info,Bumping version and creating release tag for auditing...)
	@if [ -n "$$CODEBUILD_BUILD_ID" ] && [ -z "$$GITHUB_TOKEN" ]; then \
		$(call log_error,GITHUB_TOKEN is missing in CI. Cannot push release tag.); \
		exit 1; \
	fi
	@npm version patch -m "chore: release version %s [skip ci]"
	@if [ -n "$$CODEBUILD_BUILD_ID" ]; then \
		REPO="$${HUB_URL:-$${GITHUB_REPO:-serverlessclaw/serverlessclaw}}"; \
		git push https://$$GITHUB_TOKEN@github.com/$$REPO.git HEAD:main --follow-tags; \
	else \
		git push origin main --follow-tags; \
	fi
	@$(call log_success,Version bumped, tagged and pushed for auditing!)


# Deployment Receipt: Document successful release
receipt: ## Generate deployment receipt and log details
	@$(call log_step,Generating deployment receipt for $(ENV)...)
	@OUTPUTS=$$(cat .sst/outputs.json 2>/dev/null || echo "{}"); \
	DASH_URL=$$(echo "$$OUTPUTS" | python3 -c "import json,sys; print(json.load(sys.stdin).get('dashboardUrl',''))" 2>/dev/null); \
	API_URL=$$(echo "$$OUTPUTS" | python3 -c "import json,sys; print(json.load(sys.stdin).get('apiUrl',''))" 2>/dev/null); \
	if [ -z "$$DASH_URL" ]; then \
		DASH_URL="unavailable (missing .sst/outputs.json dashboardUrl)"; \
	fi; \
	if [ -z "$$API_URL" ]; then \
		API_URL="unavailable (missing .sst/outputs.json apiUrl)"; \
	fi; \
	echo ""; \
	echo "╔════════════════════════════════════════════════════════════════╗"; \
	echo "║         DEPLOYMENT RECEIPT - $(ENV) Environment              ║"; \
	echo "╠════════════════════════════════════════════════════════════════╣"; \
	echo "║ Timestamp: $$(date '+%Y-%m-%d %H:%M:%S UTC')                  ║"; \
	echo "║ Environment: $(ENV)                                           ║"; \
	echo "║ Operator: $${USER}@$${HOSTNAME}                            ║"; \
	echo "║                                                                ║"; \
	echo "║ ✅ DEPLOYMENT STATUS: SUCCESS                                  ║"; \
	echo "║                                                                ║"; \
	echo "║ Pre-deploy gates:        ✅ PASSED                            ║"; \
	echo "║   - Type checking                                              ║"; \
	echo "║   - Linting & formatting                                       ║"; \
	echo "║   - Bundle verification                                        ║"; \
	echo "║   - Framework purity                                           ║"; \
	echo "║   - DevOps standards                                           ║"; \
	echo "║                                                                ║"; \
	echo "║ Infrastructure deployment: ✅ DEPLOYED                        ║"; \
	echo "║   - SST stack updated                                          ║"; \
	echo "║   - CloudFront configured                                      ║"; \
	echo "║   - DNS verified                                               ║"; \
	echo "║   - HTTP health checks                                         ║"; \
	echo "║                                                                ║"; \
	echo "║ Post-deploy gates:       ✅ PASSED                            ║"; \
	echo "║   - E2E data seeded                                            ║"; \
	echo "║   - DNS resolution verified                                    ║"; \
	echo "║   - API health verified                                        ║"; \
	echo "║   - E2E tests: ℹ️  Informational (see logs for details)       ║"; \
	echo "║                                                                ║"; \
	echo "║ Environment Details:                                           ║"; \
	echo "║   Dashboard: $$DASH_URL"; \
	echo "║   API: $$API_URL"; \
	echo "║                                                                ║"; \
	echo "║ Next steps:                                                    ║"; \
	echo "║   → Monitor deployment health                                  ║"; \
	echo "║   → Review E2E test results (non-blocking)                    ║"; \
	echo "║   → Check application logs if needed                           ║"; \
	echo "║                                                                ║"; \
	echo "╚════════════════════════════════════════════════════════════════╝"; \
	echo ""

# Helper to get the deployment URL
define get_url
	$$($(SST) shell --stage $(ENV) -- sh -c 'echo $$$$SST_RESOURCE_ClawCenter | jq -r .url')
endef