###############################################################################
# Makefile.release: Release and Tagging targets
###############################################################################
include makefiles/Makefile.shared.mk

.PHONY: release tag

release: ## Full release: Tier 1 -> (Deploy + Tier 2) -> (Verify + E2E) -> Tag
	@$(call log_step,Starting tiered release...)
	@$(call verify_clean)
	@$(MAKE) gate-tier-1
	@$(call log_info,Tier 1 passed. Running Tier 2 (Coverage/AIReady) and Deployment in parallel...)
	@($(MAKE) gate-tier-2 > release-tier2.log 2>&1) & \
	TIER2_PID=$$!; \
	$(MAKE) deploy ENV=$(ENV); \
	DEPLOY_EXIT=$$?; \
	wait $$TIER2_PID; \
	TIER2_EXIT=$$?; \
	if [ $$TIER2_EXIT -ne 0 ]; then \
		$(call log_error,Tier 2 checks failed. Check release-tier2.log); \
		exit 1; \
	fi; \
	if [ $$DEPLOY_EXIT -ne 0 ]; then \
		$(call log_error,Deployment failed.); \
		exit 1; \
	fi
	@$(MAKE) test-tier-3
	@$(MAKE) tag
	@$(call log_success,Release completed successfully!)

tag: ## Create and push a git tag for the current release
	@$(call log_info,Bumping version and creating release tag...)
	@npm version patch -m "chore: release version %s [skip ci]"
	@git push origin main --follow-tags
	@$(call log_success,Version bumped, tagged and pushed!)

# Helper to get the deployment URL
define get_url
	$$($(SST) shell --stage $(ENV) "echo \$$API_URL")
endef