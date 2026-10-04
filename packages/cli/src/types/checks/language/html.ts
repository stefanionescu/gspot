import type { Node } from 'web-tree-sitter';

export type MarkupAttribute = { name: string; value: string; element: string; node: Node };
