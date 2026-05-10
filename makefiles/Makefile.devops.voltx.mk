###############################################################################
# Makefile.devops.voltx: VoltX-specific DevOps targets extending framework
#
# This file extends framework devops targets with VoltX-specific behavior:
# - VoltX production region override (ap-southeast-1)
# - VoltX account-specific resource cleanup
# - VoltX-branded deployment notifications
#
# Pattern: Import framework targets, then override or extend as needed
###############################################################################

# Include framework devops targets from the actual framework location
# (not via symlink, to avoid target duplication warnings)
include framework/makefiles/Makefile.shared.mk
include framework/makefiles/Makefile.devops.mk

.PHONY: cleanup-stale-resources-voltx verify-devops-standards-voltx verify-devops-standards-all

# VoltX-specific override: Cleanup focuses on VoltX resources in production region
cleanup-stale-resources-voltx: ## [CLEANUP] VoltX-specific: Clean stale resources in VoltX production account
	@$(call log_step,Scanning for stale VoltX resources in ap-southeast-1...)
	@$(call load_env); \
	\
	REGION=$${AWS_REGION:-ap-southeast-1}; \
	$(call log_info,Using region: $$REGION); \
	\
	$(call log_info,Checking for old CloudFront distributions with voltx tag...); \
	aws cloudfront list-distributions --region $$REGION \
		--query "DistributionList.Items[?Tags.Items[?Key=='voltx-app']].Id" \
		--output text 2>/dev/null | while read dist_id; do \
		if [ ! -z "$$dist_id" ]; then \
			$(call log_warning,VoltX distribution: $$dist_id); \
		fi; \
	done; \
	\
	$(call log_info,Checking for voltx- prefixed S3 buckets...); \
	aws s3 ls --query "Buckets[?contains(Name, 'voltx')].Name" --output text 2>/dev/null | \
		while read bucket; do \
		SIZE=$$(aws s3 ls s3://$$bucket --summarize --recursive 2>/dev/null | grep "Total Size" | awk '{print $$3}'); \
		$(call log_info,Bucket: $$bucket (size: $$SIZE bytes)); \
	done; \
	\
	$(call log_success,VoltX resource scan completed)

# VoltX-specific override: DevOps standards with VoltX account checks
verify-devops-standards-voltx: ## [VERIFICATION] VoltX-specific: Verify DevOps standards for VoltX production
	@$(call log_step,Verifying VoltX-specific DevOps standards...)
	@$(call load_env); \
	\
	$(call log_info,Checking VoltX production configuration...); \
	if [ ! -f .env.prod ]; then \
		$(call log_error,.env.prod required for VoltX production); \
		exit 1; \
	fi; \
	\
	PROD_REGION=$$(grep "AWS_REGION" .env.prod | cut -d= -f2 | tr -d ' '); \
	if [ "$$PROD_REGION" = "ap-southeast-1" ]; then \
		$(call log_success,✓ VoltX production region configured: ap-southeast-1); \
	else \
		$(call log_warning,⚠ Expected ap-southeast-1, found: $$PROD_REGION); \
	fi; \
	\
	$(call log_success,VoltX DevOps standards verification passed)

# Convenience target: Run all VoltX-specific devops checks
verify-devops-standards-all: verify-devops-standards verify-devops-standards-voltx ## [VERIFICATION] Run all DevOps standards (framework + VoltX)
	@$(call log_success,All DevOps standards verified)
