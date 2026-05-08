# ServerlessClaw Framework Instructions

## Core Mandate: OSS Purity
ServerlessClaw is a generic, product-agnostic OSS framework. 

1.  **Strict Product Separation:** This directory (`framework/`) MUST NOT contain any code, assets, or configuration specific to downstream products (e.g., Voltx, propertyflow).
2.  **Extensibility First:** If a product needs a custom behavior, implement a generic hook, provider slot, or extension point within the framework.
3.  **No Downstream Imports:** Never import packages from outside this `framework/` directory.
4.  **Semantic Theming:** Use CSS variables for all colors and branding. Do not hardcode product-specific color palettes.
5.  **Subtree Compliance:** This directory is the source for the `serverlessclaw` subtree. Ensure all commits here are "clean" and suitable for upstreaming to the canonical framework repository.
