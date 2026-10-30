import type { Node } from 'web-tree-sitter';
import type { DOCSTRING_STYLES, GRAMMAR_FENCE_PARSERS } from '#cli/config/checks/language/language.ts';

export type MarkupAttribute = { name: string; value: string; element: string; node: Node };

export type FormatFenceParser = 'json' | 'jsonc' | 'toml' | 'yaml';

export type GrammarFenceParser = (typeof GRAMMAR_FENCE_PARSERS)[number];

export type FenceParser = FormatFenceParser | GrammarFenceParser;

export type FenceSyntaxError = { line: number; message: string };

export type PydoclintOptions = { command: string[]; style: PythonDocstringStyle | undefined };

export type PythonDocstringStyle = (typeof DOCSTRING_STYLES)[number];
