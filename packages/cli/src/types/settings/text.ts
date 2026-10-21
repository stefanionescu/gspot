import type { TomlTable } from '#cli/types/settings/file.ts';
import type { KeyPath } from '#cli/types/parsers/editable-file.ts';
import type { KnownSettings } from '#cli/types/settings/inheritance.ts';

/** An ordered header and its written values. */
export type LayoutSection = { path: KeyPath; table: TomlTable };

/** A written table and its defaults, while defaults get dropped in order. */
export type WrittenTable = { scope: string; table: TomlTable; known: KnownSettings };

/** A concrete syntax owner before mapping its path through your own edit. */
export type TomlCommentAnchor = { kind: string; path: KeyPath };
