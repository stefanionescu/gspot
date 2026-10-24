import type { TomlTable } from '#cli/types/settings/file.ts';
import type { KeyPath } from '#cli/types/parsers/editable-file.ts';

export type LayoutSection = { path: KeyPath; table: TomlTable };

export type TomlCommentAnchor = { kind: string; path: KeyPath };
