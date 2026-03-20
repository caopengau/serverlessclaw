###############################################################################
# Makefile.release: Release and Tagging targets
###############################################################################
include makefiles/Makefile.shared.mk

.PHONY: release tag

release: ## Full release: test -> deploy -> verify -> tag
	@$(call log_step,Starting full release...)
	@$(call verify_clean)
	@$(MAKE) check test
	@$(MAKE) deploy ENV=$(ENV)
	@$(MAKE) verify URL=$$(cat .sst/outputs.json | python3 -c "import json,sys; print(json.load(sys.stdin)['apiUrl'])")
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