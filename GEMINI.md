# Voltx Project Instructions

## Project Context

This is the **Voltx** project, built on top of the **ServerlessClaw** framework.

## Git Subtree Boundary Rules

The `framework/` directory is managed as a **git subtree** from the canonical ServerlessClaw OSS repository. To maintain architectural integrity and OSS compatibility, you MUST follow these rules:

1.  **Framework Genericity:** The `framework/` directory MUST remain strictly generic. Never add Voltx-specific strings, logos, configuration keys, or product-specific logic inside `framework/`.
2.  **Product Isolation:** All Voltx-specific features, themes, and logic must reside in `packages/voltx-*` (e.g., `packages/voltx-ui`, `packages/voltx-core`).
3.  **Extension Injection:** Use the established extension patterns (e.g., `ExtensionProvider`, `extensions/hub`) to inject Voltx functionality into the framework at runtime.
4.  **Contribution Workflow:**
    - Changes within `framework/` should be foundational improvements that benefit any project using the framework.
    - If a feature is Voltx-specific but requires a framework hook, add a generic hook to `framework/` and implement the Voltx-specific logic in the `packages/voltx-*` layer.
5.  **No Leaky Abstractions:** Do not import product-specific packages from within the `framework/` directory. The framework should have zero knowledge of the products that consume it.
6.  **Git History Integrity (CRITICAL):**
    - The repository history MUST be kept clean. All `framework/` updates MUST use the `--squash` flag.
    - Never perform a raw `git subtree pull` without `--squash`. This prevents upstream history leakage.
    - **Agent Verification:** After any framework sync, the agent MUST run `git log -n 5 --oneline` and verify that the history remains linear and squashed.
    - If history is contaminated, the agent MUST stop and alert the user.

## Architectural Priorities

- **Performance:** Pay close attention to Lambda cold starts and bundle sizes. Use dynamic imports for heavy dependencies.
- **Safety:** Always respect the `Shield` (SafetyEngine) rules when suggesting or implementing tool-using agents.
- **Visuals:** Voltx has a premium, sci-fi, "cyber-energy" aesthetic. Ensure UI changes in `voltx-ui` maintain this high-fidelity look.
