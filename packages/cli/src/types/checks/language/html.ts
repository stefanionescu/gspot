// The types of checks/language/html in this package.
import type { Node } from 'web-tree-sitter';

export type MarkupProblem = { node: Node; rule: string; text: string };
export type MarkupAttribute = { name: string; value: string; element: string; node: Node };
