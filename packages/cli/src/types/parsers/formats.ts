import type { parseDocument } from '@decimalturn/toml-patch';
import type { KeyPath } from '#cli/types/parsers/editable-file.ts';

export type CodeFence = { language: string; attributes: string; body: string; startLine: number; endLine: number };

export type DirectiveScan = { token: string | undefined; end: number };

type TomlComment = { raw: string; start: number; line: number };

type TomlCommentBlock = { path: KeyPath; owned: TomlComment[]; free: TomlComment[] };

export type TomlBlock = ReturnType<typeof parseDocument>['cst'][number];

export type TomlKeyValue = Extract<TomlBlock, { type: 'KeyValue' }>;

export type TomlValue = TomlKeyValue['value'];

export type TomlCommentNode = Extract<TomlBlock, { type: 'Comment' }>;

export type SourceRange = { range?: readonly [number, number] };

export type TomlTableOptions = { filePath: string; keys: KeyPath; create: boolean };

export type TomlPathNode = { path: KeyPath } & (
    | { kind: 'key'; node: TomlKeyValue }
    | { kind: 'item'; node: TomlValue }
    | { kind: 'header'; node: Exclude<TomlBlock, TomlKeyValue | TomlCommentNode>['key'] }
);

export type TomlSyntax = {
    document: ReturnType<typeof parseDocument>;
    value: Record<string, unknown>;
    pathNodes: TomlPathNode[];
    comments: TomlCommentNode[];
};

export type TomlComments = Map<string, TomlCommentBlock>;

export type TomlTablePositions = {
    value: Record<string, unknown>;
    counts: Map<string, number>;
    active: Map<string, number>;
};

export type TomlTextChunk = { start: number; end: number; text: string };

export type TomlAnchoredComment = { comment: TomlCommentNode; anchor: TomlPathNode | undefined; identity: string };

export type TomlCommentPlacement = {
    kind: string;
    path: KeyPath | undefined;
    comment: TomlCommentNode;
    placement: 'owned' | 'free';
};

export type TomlCommentMove = { source: TomlAnchoredComment; found: TomlAnchoredComment | undefined };
