import type { Level } from '#cli/types/configurations.ts';

/** Policy choices computed before a sandbox installs applicable tools. */
export type SandboxInstallation = { without?: string[]; level?: Level };
