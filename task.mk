# Configuration Refactoring Tasks (Remove after completion)

.PHONY: task-config-refactor
task-config-refactor:
	@echo "1. [x] Move Backbone Agent Prompts to DDB (AgentRegistry.getAgentConfig)"
	@echo "2. [x] Externalize ReasoningProfile -> Model mapping to DDB"
	@echo "3. [x] Move PROTECTED_FILES list to ConfigTable"
	@echo "4. [x] Make 'max_tool_iterations' configurable via DDB"
	@echo "5. [x] Implement 'circuit_breaker_threshold' for Auto -> HITL fallback"
	@echo "6. [x] Centralize all default thresholds (review_freq, min_gaps) to DDB-first lookup"
