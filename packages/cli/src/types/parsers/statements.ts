import type { Node } from 'web-tree-sitter';

export type CountedLanguage = 'python' | 'swift' | 'bash';

export type IsSubstantial = (node: Node, language: CountedLanguage, threshold: number) => boolean;
