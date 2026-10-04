import type { Node } from 'web-tree-sitter';

export type StatementLanguage = 'python' | 'swift' | 'bash';

export type StatementContent = (node: Node, language: StatementLanguage, threshold: number) => boolean;
