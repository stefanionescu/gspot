// Types of the web checks.
import type { Node } from 'web-tree-sitter';

/** One problem found at a node of a parsed HTML file. */
export type MarkupProblem = { node: Node; rule: string; text: string };
