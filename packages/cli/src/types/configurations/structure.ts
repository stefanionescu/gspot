import type { Node } from 'web-tree-sitter';
import type { ImportRule } from '#cli/types/settings.ts';
import type { ParsedLanguage } from '#cli/types/parsers.ts';
import type { CheckFinding } from '#cli/types/engine/run.ts';

export type FolderChild = { name: string; kind: 'file' | 'folder' };

export type ParsedSource = { path: string; language: ParsedLanguage; rootNode: Node; captures: Map<string, Node[]> };

export type ImportOwners = { node: Node; module: string; owners: Array<number | undefined> };

export type RuleLookup = { rules: ImportRule[]; findOwner: (path: string) => number | undefined; allowed: string[][] };

export type TopLevelFunction = { name: string; isPrivate: boolean };

// `owners` maps each type that other files can name to the rules that declare it. `hidden` maps each rule to the names
// that its files declare for a narrower reach: inside a type, as a generic parameter, or as a private top-level type.
export type SwiftDeclarations = { owners: Map<string, Set<string>>; hidden: Map<string, Set<string>> };

export type TrivialFunction = { finding: CheckFinding; key?: string };

// `caller` names the function that calls the name, or the file when the call sits outside a function. A use that is
// not a call has no caller.
export type ScriptUse = { name: string; caller?: string };

export type ExportedFunction = { name: string; file: string; line: number; column: number };
