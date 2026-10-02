// The types of checks/general/structure in this package.
import type { Node } from 'web-tree-sitter';

export type SuppressionForm = {
    form: string;
    marker: RegExp;
    inlineMarker: RegExp;
    reason: RegExp;
    forbidden: boolean;
};

export type PathPattern = { pattern: string; where: string };

export type Language = 'python' | 'swift' | 'bash';
export type Substance = (node: Node, language: Language, threshold: number) => boolean;

/** An entry a directory holds, as the tracked file list sees it. */
export type DirectoryEntry = { name: string; kind: 'file' | 'dir' };

export type SourceComment = { line: number; text: string; standalone: boolean };
