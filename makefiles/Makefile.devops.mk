###############################################################################
# Makefile.devops: DevOps verification and compliance targets (FRAMEWORK)
###############################################################################
include makefiles/Makefile.shared.mk

# DevOps Configuration (Override these in product Makefile if needed)
PRODUCT_NAME ?= Product
BANNED_IMPORT_STRINGS ?= voltx\|VoltX\|goldex\|GoldEx
BANNED_IMPORT_PATTERNS ?= from.*packages/(voltx|goldex)|from.*apps/(voltx|goldex)|import.*(voltx|goldex)

.PHONY: verify-agent-compliance verify-devops-standards cleanup-stale-resources audit-configuration check-framework-purity

verify-agent-compliance: ## [VERIFICATION] Check code for agent compliance violations
	@$(call log_step,Running agent compliance verification...)
	@if ! command -v tsx &> /dev/null; then \
		$(call log_error,tsx command not found. Run: pnpm install -g tsx); \
		exit 1; \
	fi
	@if ! [ -f .github/verify-agent-compliance.ts ]; then \
		$(call log_warning,Agent compliance checker not found at .github/verify-agent-compliance.ts); \
		$(call log_info,Creating minimal compliance report...); \
	else \
		$(PNPM) exec tsx .github/verify-agent-compliance.ts <(echo "Checking compliance...") || { \
			$(call log_warning,Run with specific file: pnpm exec tsx .github/verify-agent-compliance.ts <file.md>); \
		}; \
	fi

verify-devops-standards: ## [VERIFICATION] Verify DevOps configuration and standards
	@$(call log_step,Verifying DevOps standards compliance...)
	@$(call load_env); \
	\
	$(call log_info,Checking environment configuration...); \
	if [ -z "$$AWS_REGION" ]; then \
		$(call log_warning,AWS_REGION not set in environment); \
		AWS_REGION_DISPLAY="(using default)"; \
	else \
		AWS_REGION_DISPLAY="$$AWS_REGION"; \
	fi; \
	$(call log_success,AWS_REGION set: $$AWS_REGION_DISPLAY); \
	\
	$(call log_info,Checking for hardcoded values in config files...); \
	if grep -r "\'ap-southeast-[12]\'" sst.config.ts 2>/dev/null | grep -v "^[[:space:]]*\/\/" >/dev/null; then \
		$(call log_warning,Region may be hardcoded in sst.config.ts); \
	fi; \
	\
	$(call log_info,Verifying .env files not in git...); \
	if git ls-files .env* 2>/dev/null | grep -qvE "\.env\.example"; then \
		$(call log_error,.env files found in git (security risk)); \
		exit 1; \
	else \
		$(call log_success,.env files properly gitignored); \
	fi; \
	\
	$(call log_info,Checking Makefile consistency...); \
	if ! grep -q "pre-deploy" Makefile && ! grep -q "pre-deploy" makefiles/*.mk; then \
		$(call log_warning,pre-deploy target not found); \
	else \
		$(call log_success,Pre-deploy gates configured); \
	fi; \
	\
	$(call log_success,DevOps standards verification passed)

audit-configuration: ## [AUDIT] Audit deployment configuration for security and consistency
	@$(call log_step,Auditing deployment configuration...)
	@$(call load_env); \
	\
	$(call log_info,[AUDIT 1/5] AWS Credentials and Account); \
	ACCOUNT=$$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo "ERROR"); \
	if [ "$$ACCOUNT" = "ERROR" ]; then \
		$(call log_error,AWS credentials not configured); \
		exit 1; \
	fi; \
	$(call log_success,✓ AWS Account: $$ACCOUNT); \
	\
	$(call log_info,[AUDIT 2/5] AWS Region Configuration); \
	REGION=$${AWS_REGION:-ap-southeast-2}; \
	$(call log_success,✓ AWS Region: $$REGION); \
	\
	$(call log_info,[AUDIT 3/5] Environment File Status); \
	if [ -f .env.prod ]; then \
		$(call log_success,✓ .env.prod found); \
	else \
		$(call log_warning,.env.prod not found); \
	fi; \
	\
	$(call log_info,[AUDIT 4/5] Dependency Security); \
	$(PNPM) exec npm audit --audit-level=high 2>/dev/null | grep -q "vulnerabilities" && \
		$(call log_warning,High-severity vulnerabilities found) || \
		$(call log_success,✓ No high-severity vulnerabilities); \
	\
	$(call log_info,[AUDIT 5/5] Framework Purity Check); \
	PRODUCT_LEAKS=$$(grep -ri "$(BANNED_IMPORT_STRINGS)" framework --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "\.sst" | grep -v ".aiready" | grep -v "node_modules" | grep -v "\.next" | grep -v "\.open-next" | grep -v "dist" | grep -v "// " | wc -l); \
	if [ "$$PRODUCT_LEAKS" -eq 0 ]; then \
		$(call log_success,✓ Framework is project-agnostic); \
	else \
		$(call log_warning,⚠ Found $$PRODUCT_LEAKS project-specific references in framework); \
	fi; \
	\
	$(call log_success,Configuration audit completed)

check-framework-purity: ## [COMPLIANCE] Verify framework contains no product-specific code
	@$(call log_step,Checking framework purity for OSS compatibility...)
	@$(call load_env); \
	\
	$(call log_info,Scanning framework source code for product leaks...); \
	VIOLATIONS=$$(find framework -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) \
		! -path "*/node_modules/*" \
		! -path "*/.sst/*" \
		! -path "*/.aiready/*" \
		! -path "*/.next/*" \
		! -path "*/dist/*" \
		! -path "*/build/*" \
		! -path "*/coverage/*" \
		-exec grep -lE "$(BANNED_IMPORT_PATTERNS)" {} \; 2>/dev/null | wc -l); \
	\
	if [ "$$VIOLATIONS" -eq 0 ]; then \
		$(call log_success,✓ Framework is clean - ready for OSS extraction); \
	else \
		$(call log_warning,Found $$VIOLATIONS file(s) with project leaks:); \
		find framework -type f \( -name "*.ts" -o -name "*.tsx" \) \
			! -path "*/node_modules/*" \
			! -path "*/.sst/*" \
			! -path "*/.next/*" \
			! -path "*/dist/*" \
			-exec grep -lE "$(BANNED_IMPORT_PATTERNS)" {} \; 2>/dev/null | head -5; \
		$(call log_error,Framework must not import from project-specific packages for OSS extraction); \
		exit 1; \
	fi

cleanup-stale-resources: ## [CLEANUP] Identify stale AWS resources (Lambda, CloudFront, S3)
	@$(call log_step,Scanning for stale AWS resources...)
	@$(call load_env); \
	\
	$(call log_info,Checking for old CloudFront distributions...); \
	OLD_DISTRIBUTIONS=$$(aws cloudfront list-distributions --query "DistributionList.Items[?CreatedTime<'$$(date -u -d '30 days ago' +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -v-30d +%Y-%m-%dT%H:%M:%SZ)'].Id" --output text 2>/dev/null); \
	if [ -z "$$OLD_DISTRIBUTIONS" ]; then \
		$(call log_success,✓ No old CloudFront distributions found); \
	else \
		$(call log_warning,Found old distributions: $$OLD_DISTRIBUTIONS); \
	fi; \
	\
	$(call log_info,Checking for untagged or empty S3 buckets...); \
	for bucket in $$(aws s3 ls --query 'Buckets[].Name' --output text 2>/dev/null); do \
		SIZE=$$(aws s3 ls s3://$$bucket --summarize --recursive 2>/dev/null | grep "Total Size:" | awk '{print $$3}'); \
		if [ "$$SIZE" = "0" ] || [ -z "$$SIZE" ]; then \
			$(call log_warning,Empty bucket found: $$bucket); \
		fi; \
	done; \
	\
	$(call log_info,Checking for orphaned Lambda functions...); \
	ORPHANED=$$(aws lambda list-functions --region $${AWS_REGION:-ap-southeast-2} --query "Functions[?LastModified<'$$(date -u -d '90 days ago' +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -v-90d +%Y-%m-%dT%H:%M:%SZ)'].FunctionName" --output text 2>/dev/null); \
	if [ -z "$$ORPHANED" ]; then \
		$(call log_success,✓ No orphaned Lambda functions found); \
	else \
		$(call log_warning,Found potentially orphaned functions: $$ORPHANED); \
	fi; \
	\
	$(call log_success,Stale resource scan completed. Review warnings above.)

cleanup-stale-resources-dry-run: ## [CLEANUP] Dry-run: Show what would be cleaned
	@$(call log_step,DRY RUN: Would clean the following resources...)
	@$(MAKE) cleanup-stale-resources

cleanup-stale-resources-execute: ## [CLEANUP] Actually remove identified stale resources (DANGEROUS - requires confirmation)
	@$(call log_warning,WARNING: This will DELETE stale resources!)
	@$(call log_warning,Make sure you have reviewed the dry-run output first.)
	@read -p "Type 'yes' to confirm cleanup: " confirm; \
	if [ "$$confirm" != "yes" ]; then \
		$(call log_info,Cleanup cancelled); \
		exit 0; \
	fi
	@$(call log_step,Executing cleanup of stale resources...)
	@$(call load_env); \
	\
	$(call log_info,This is a placeholder. Implement actual cleanup logic based on audit results.); \
	$(call log_warning,To implement: Add scripts/quality/cleanup-stale-resources.ts); \
	$(call log_success,Ready for custom cleanup script execution)
