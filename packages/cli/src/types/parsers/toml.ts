import type { parseDocument } from '@decimalturn/toml-patch';
import type { NODE_KINDS } from '#cli/config/parsers/toml.ts';
import type { KeyPath } from '#cli/types/platform/document.ts';

export type TomlBlock = ReturnType<typeof parseDocument>['cst'][number];

export type KeyValue = Extract<TomlBlock, { type: 'KeyValue' }>;

export type Value = KeyValue['value'];

/** A syntax node with the kind field every parser node carries. */
export type Kinded = { type: unknown };

/** The kinds of syntax node the parser produces, as the literals it names them by. */
export type NodeKind = (typeof NODE_KINDS)[number];

export type Edit = { start: number; end: number; replacement: string };

export type InlineTable = Extract<Value, { type: 'InlineTable' }>;

export type InlineArray = Extract<Value, { type: 'InlineArray' }>;

export type Comment = Extract<TomlBlock, { type: 'Comment' }>;

/** Source extent of a parsed concrete syntax node. */
export type SourceRange = { range?: readonly [number, number] };

export type TomlAssignment = { key: string; value: Value };

/** Formatting supplied by the policy writer, before TOML layout is rewritten. */
export type TomlLayout = { indent: string; width: number };

/** A TOML document that preserves comments and layout when reading and editing keys. */
export type TomlDocument = {
    value(path: KeyPath): unknown;
    set(path: KeyPath, value: unknown): void;
    text(): string;
};

/** The authored file and its TOML text. */
export type TomlInput = { path: string; source: string };

/** A parent table to retrieve or create while editing a file. */
export type TomlTableOptions = { filePath: string; keys: KeyPath; create: boolean };
