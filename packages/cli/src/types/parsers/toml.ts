import type { parseDocument } from '@decimalturn/toml-patch';
import type { KeyPath } from '#cli/types/parsers/editable-file.ts';

/** Exact text and position keep merged owned comments in their physical order. */
type TomlComment = { raw: string; start: number; line: number };

/** Free comments keep their spacing; owned comments move with their key. */
type TomlCommentBlock = { path: KeyPath; owned: TomlComment[]; free: TomlComment[] };

export type TomlBlock = ReturnType<typeof parseDocument>['cst'][number];

export type TomlKeyValue = Extract<TomlBlock, { type: 'KeyValue' }>;

export type TomlValue = TomlKeyValue['value'];

export type TomlCommentNode = Extract<TomlBlock, { type: 'Comment' }>;

/** Source extent of a parsed concrete syntax node. */
export type SourceRange = { range?: readonly [number, number] };

/** The authored file and its TOML text. */
export type TomlInput = { path: string; source: string };

/** A parent table to retrieve or create while editing a file. */
export type TomlTableOptions = { filePath: string; keys: KeyPath; create: boolean };

/** A key or header that can keep its own comment block. */
export type TomlPathNode = { path: KeyPath } & (
    | { kind: 'key'; node: TomlKeyValue }
    | { kind: 'item'; node: TomlValue }
    | { kind: 'header'; node: Exclude<TomlBlock, TomlKeyValue | TomlCommentNode>['key'] }
);

/** Original concrete syntax and its authored values, before defaults. */
export type TomlSyntax = {
    document: ReturnType<typeof parseDocument>;
    value: Record<string, unknown>;
    pathNodes: TomlPathNode[];
    comments: TomlCommentNode[];
};

/** Source owners and target owners use the same semantic key paths. */
export type TomlComments = Map<string, TomlCommentBlock>;

/** Table paths track array-of-table positions while reading one document. */
export type TomlTablePositions = {
    value: Record<string, unknown>;
    counts: Map<string, number>;
    active: Map<string, number>;
};

/** A concrete syntax owner before mapping its path through your own edit. */
export type TomlCommentAnchor = { kind: string; path: KeyPath };

/** A syntax chunk inserted, kept, or left out around its owner. */
export type TomlTextChunk = { start: number; end: number; text: string };

/** Original comment identity distinguishes repeated physical text with different owners. */
export type TomlAnchoredComment = { comment: TomlCommentNode; anchor: TomlPathNode | undefined; identity: string };

/** One original TOML comment and the syntax entry that keeps it. */
export type TomlCommentPlacement = {
    kind: string;
    path: KeyPath | undefined;
    comment: TomlCommentNode;
    placement: 'owned' | 'free';
};
