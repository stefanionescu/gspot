import type { parseDocument } from '@decimalturn/toml-patch';
import type { KeyPath } from '#cli/types/parsers/editable-file.ts';

/** One comment: its text, its offset, and its line. */
type TomlComment = { raw: string; start: number; line: number };

/** Free comments keep their spacing; owned comments move with their key. */
type TomlCommentBlock = { path: KeyPath; owned: TomlComment[]; free: TomlComment[] };

export type TomlBlock = ReturnType<typeof parseDocument>['cst'][number];

export type TomlKeyValue = Extract<TomlBlock, { type: 'KeyValue' }>;

export type TomlValue = TomlKeyValue['value'];

export type TomlCommentNode = Extract<TomlBlock, { type: 'Comment' }>;

/** Source extent of a parsed concrete syntax node. */
export type SourceRange = { range?: readonly [number, number] };

/** A TOML file: its path and its text. */

/** A parent table to retrieve or create while editing a file. */
export type TomlTableOptions = { filePath: string; keys: KeyPath; create: boolean };

/** A key or header that can keep its own comment block. */
export type TomlPathNode = { path: KeyPath } & (
    | { kind: 'key'; node: TomlKeyValue }
    | { kind: 'item'; node: TomlValue }
    | { kind: 'header'; node: Exclude<TomlBlock, TomlKeyValue | TomlCommentNode>['key'] }
);

/** The syntax tree of a TOML file and its values as written, before defaults. */
export type TomlSyntax = {
    document: ReturnType<typeof parseDocument>;
    value: Record<string, unknown>;
    pathNodes: TomlPathNode[];
    comments: TomlCommentNode[];
};

/** The comments to place, by the kind and key path of the entry that keeps them. */
export type TomlComments = Map<string, TomlCommentBlock>;

/** Table paths track array-of-table positions while reading one document. */
export type TomlTablePositions = {
    value: Record<string, unknown>;
    counts: Map<string, number>;
    active: Map<string, number>;
};

/** A text replacement: the text that takes the place of the range from start to end. */
export type TomlTextChunk = { start: number; end: number; text: string };

/** A comment, the entry it describes, and an identity that keeps equal comments on different entries apart. */
export type TomlAnchoredComment = { comment: TomlCommentNode; anchor: TomlPathNode | undefined; identity: string };

/** One original TOML comment and the syntax entry that keeps it. */
export type TomlCommentPlacement = {
    kind: string;
    path: KeyPath | undefined;
    comment: TomlCommentNode;
    placement: 'owned' | 'free';
};
