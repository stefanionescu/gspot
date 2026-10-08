import type { TomlTable, KnownSettings } from '#cli/types/policy/settings.ts';

/** An authored origin and its actual selected defaults during canonical omission. */
export type DefaultPolicyTable = { scope: string; table: TomlTable; surface: KnownSettings };
