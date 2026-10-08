import type { KeyPath } from '#cli/types/parsers/document.ts';
import type { TomlTable } from '#cli/types/policy/settings.ts';

/** Canonical header sections separate scalar assignments from their authored descendants. */
export type PolicySection = { path: KeyPath; table: TomlTable };

/** Canonical text and the exact native patch limitations found in the original syntax. */
export type PolicyLayout = { text: string; noncontiguous: boolean; missingArrays: Set<string> };
