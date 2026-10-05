import type { TSESTree } from '@typescript-eslint/utils';

/** Parsed dependency modules and ancestor paths used by one barrel rule evaluation. */
export type ExportSources = { modules: Map<string, TSESTree.Program>; ancestors: Set<string> };
