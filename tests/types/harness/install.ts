import type { Level } from '#cli/types/configurations.ts';

/** Policy choices resolved before a sandbox installs applicable tools. */
export type SandboxInstallation = { without?: string[]; level?: Level };
