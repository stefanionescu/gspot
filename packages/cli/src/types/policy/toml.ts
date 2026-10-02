// The types of policy/toml in this package.
import type { parseDocument } from '@decimalturn/toml-patch';

export type TomlBlock = ReturnType<typeof parseDocument>['cst'][number];
export type KeyValue = Extract<TomlBlock, { type: 'KeyValue' }>;
export type Value = KeyValue['value'];

/** A syntax node with the kind field every parser node carries. */
export type Kinded = { type: unknown };

/** The kinds of syntax node the parser produces, as the literals it names them by. */
export type NodeKind =
    | 'Document'
    | 'Table'
    | 'TableKey'
    | 'TableArray'
    | 'TableArrayKey'
    | 'KeyValue'
    | 'Key'
    | 'String'
    | 'Integer'
    | 'Float'
    | 'Boolean'
    | 'DateTime'
    | 'InlineArray'
    | 'InlineItem'
    | 'InlineTable'
    | 'Comment';
export type Edit = { start: number; end: number; replacement: string };
