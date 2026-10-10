import type { Level } from '#cli/types/configurations.ts';
import type { Log } from '#cli/types/lifecycle/ownership.ts';
import type { GeneratedFile } from '#cli/types/generation/files.ts';

/** Policy choices computed before a sandbox installs applicable tools. */
export type SandboxInstallation = { without?: string[]; level?: Level };

/** The suite-owned npm installation and its exact native lockfile. */
export type SharedToolProject = { lockfile: GeneratedFile; install?: (log: Log) => void };
