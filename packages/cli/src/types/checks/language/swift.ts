import type { Node } from 'web-tree-sitter';
import type { Root } from '#cli/types/platform/root.ts';
import type { SwiftSource } from '#cli/types/parsers/swift.ts';

/** Source comments whose inline documentation positions need native findings restored. */
export type InlineDocumentation = { source: SwiftSource; comments: Node[]; inline: Node[] };

/** The build of one Swift scope. */
export type SwiftBuildPlan = {
    /** The build folder of this scope. */
    folder: string;
    /** Where the compiler log is written. */
    log: string;
    argv: string[];
    /** The analyzer clears this folder so its log includes every compiler call. */
    scratch?: string;
};

/** The read build status and its compiler output. */
export type SwiftBuildOutput = { code: number; output: string; source: string };

/** Independent build state for each native Swift consumer. */
export type SwiftBuildPurpose = 'compile' | 'analyze' | 'coverage' | 'periphery';

/** Prepared source copy and its locked root, disposed by the native consumer. */
export type PreparedSwiftBuild = { files: Root; source: string };
