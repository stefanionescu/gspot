import type { TomlTable } from '#cli/types/settings/file.ts';
import type { KeyPath } from '#cli/types/parsers/editable-file.ts';
import type { KnownSettings } from '#cli/types/settings/inheritance.ts';

/** An ordered header and its written values. */
export type LayoutSection = { path: KeyPath; table: TomlTable };

/** A written table, its scope, and the known settings of that scope, which dropDefaults compares against. */
export type WrittenTable = { scope: string; table: TomlTable; known: KnownSettings };

/** The kind and key path of the entry that keeps a comment, before a settings edit moves the entry. */
export type TomlCommentAnchor = { kind: string; path: KeyPath };
