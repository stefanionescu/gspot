import type { parseDocument } from '@decimalturn/toml-patch';
import type { KeyPath } from '#cli/types/parsers/document.ts';
import type { NODE_KINDS } from '#cli/config/parsers/toml.ts';

export type TomlBlock = ReturnType<typeof parseDocument>['cst'][number];

export type KeyValue = Extract<TomlBlock, { type: 'KeyValue' }>;

export type Value = KeyValue['value'];

/** A syntax node with the kind field every parser node carries. */
export type Kinded = { type: unknown };

/** The kinds of syntax node the parser produces, as the literals it names them by. */
export type NodeKind = (typeof NODE_KINDS)[number];

export type InlineTable = Extract<Value, { type: 'InlineTable' }>;

export type InlineArray = Extract<Value, { type: 'InlineArray' }>;

export type Comment = Extract<TomlBlock, { type: 'Comment' }>;

/** Source extent of a parsed concrete syntax node. */
export type SourceRange = { range?: readonly [number, number] };

/** The authored file and its TOML text. */
export type TomlInput = { path: string; source: string };

/** A parent table to retrieve or create while editing a file. */
export type TomlTableOptions = { filePath: string; keys: KeyPath; create: boolean };

/** A key or header that can retain its own physical comment block. */
export type TomlSyntaxEntry = { path: KeyPath } & (
    | { kind: 'key'; node: KeyValue }
    | { kind: 'item'; node: Value }
    | { kind: 'header'; node: Exclude<TomlBlock, KeyValue | Comment>['key'] }
);

/** Original concrete syntax and its authored values, before defaults. */
export type TomlSyntax = {
    document: ReturnType<typeof parseDocument>;
    value: Record<string, unknown>;
    entries: TomlSyntaxEntry[];
    comments: Comment[];
};

/** Exact text and position keep merged owned comments in their physical order. */
export type TomlComment = { raw: string; start: number; line: number };

/** Free prose retains separation; owned comments move with their semantic owner. */
export type TomlCommentBlock = { path: KeyPath; owned: TomlComment[]; free: TomlComment[] };

/** Source owners and target owners use the same semantic key paths. */
export type TomlComments = Map<string, TomlCommentBlock>;

/** Native table paths track array-of-table positions while reading one document. */
export type TomlTablePositions = {
    value: Record<string, unknown>;
    counts: Map<string, number>;
    active: Map<string, number>;
};

/** A concrete syntax owner before its path is mapped through an authored edit. */
export type TomlCommentOwner = { kind: string; path: KeyPath };

/** A native syntax chunk inserted, retained, or omitted around its semantic owner. */
export type TomlTextChunk = { start: number; end: number; text: string };

/** Original comment identity distinguishes repeated physical text with different owners. */
export type TomlOwnedComment = { comment: Comment; owner: TomlSyntaxEntry | undefined; identity: string };
