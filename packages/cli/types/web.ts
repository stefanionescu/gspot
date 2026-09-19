// Types of the web checks.
import type { Node } from 'web-tree-sitter';

/** One problem found at a node of a parsed HTML file. */
export type MarkupProblem = { node: Node; rule: string; text: string };

/** The build of one static site scope. */
export type SiteBuild = {
    /** The folder the build ran in. */
    cwd: string;
    command: string;
    /** The absolute output folder. */
    output: string;
    isBuilt: boolean;
    /** The last lines the build printed, for a failure message. */
    said: string;
};

/** One size ceiling of the policy: the output paths it sums and the most kilobytes they may weigh, compressed. */
export type SizeLimit = { paths: string[]; kb: number; reason?: string };
