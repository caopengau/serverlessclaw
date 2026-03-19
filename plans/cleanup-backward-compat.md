# Backward Compatibility Cleanup Plan

## Summary

Clean up backward compatibility code and files in the Serverless Claw project. These files were created during modularization to maintain backward compatibility but are no longer needed.

## Files to Remove

### 1. `core/tools/system.ts`
- Main backward compatibility re-export file
- Re-exports from: `deployment.ts`, `rollback.ts`, `health-check.ts`, `validation.ts`, `messaging.ts`, `runtime-config.ts`, `knowledge-agent.ts`, `topology-discovery.ts`
- Used internally by `core/tools/index.ts`

### 2. `core/tools/definitions.ts`
- Deprecated file marked with `@deprecated` JSDoc
- Re-exports `toolDefinitions` from `./definitions/index`
- Used by 13 files in core/tools/ and core/lib/

## Aliases to Remove

### 3. `core/tools/knowledge-storage.ts` (lines 313-314)
- Remove camelCase alias: `inspectTrace = INSPECT_TRACE`

### 4. `core/tools/knowledge-agent.ts` (lines 188-189)
- Remove camelCase alias: `listAgents = LIST_AGENTS`

### 5. `core/tools/index.ts` (lines 76-77)
- Remove camelCase alias: `TOOLS.switchModel = TOOLS.SWITCH_MODEL`

## Import Updates Required

After removing the backward compatibility files, update these imports:

| File | Current Import | New Import |
|------|---------------|------------|
| `core/tools/index.ts` | `import * as systemTools from './system'` | Direct tool imports or remove if unused |
| All files using `../tools/definitions` | `toolDefinitions from '../tools/definitions'` | `toolDefinitions from '../tools/definitions/index'` |

## Files Importing from `../tools/definitions` (need update)
- core/lib/schema.ts
- core/tools/knowledge-mcp.ts
- core/tools/topology-discovery.ts
- core/tools/runtime-config.ts
- core/tools/metadata.ts
- core/tools/health-check.ts
- core/tools/knowledge-storage.ts
- core/tools/rollback.ts
- core/tools/deployment.ts
- core/tools/index.ts
- core/tools/knowledge-agent.ts
- core/tools/validation.ts
- core/tools/messaging.ts
- core/tools/fs.ts

## Execution Order

1. Remove camelCase aliases from knowledge-storage.ts
2. Remove camelCase aliases from knowledge-agent.ts  
3. Remove camelCase alias from index.ts
4. Update all imports from `./definitions` to `./definitions/index`
5. Remove `core/tools/definitions.ts`
6. Update `core/tools/index.ts` to not import from `./system`
7. Remove `core/tools/system.ts`
8. Run tests to verify

## Notes

- Type re-exports in `core/lib/tracer.ts` and `core/lib/utils/topology.ts` should be kept as they provide type compatibility
- No external package consumers were found for these files
