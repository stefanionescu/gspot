import type { TomlTable } from '#cli/types/settings/file.ts';
import type { KeyPath } from '#cli/types/parsers/editable-file.ts';
import type { AvailableSettings } from '#cli/types/settings/inheritance.ts';

export type LayoutSection = { path: KeyPath; table: TomlTable };

export type WrittenTable = { scope: string; table: TomlTable; available: AvailableSettings };

export type TomlCommentAnchor = { kind: string; path: KeyPath };
