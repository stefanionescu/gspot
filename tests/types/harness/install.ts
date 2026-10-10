import type { Level } from '#cli/types/configurations.ts';
import type { GeneratedFile } from '#cli/types/generation/files.ts';

/** Policy choices computed before a sandbox installs applicable tools. */
export type SandboxInstallation = { without?: string[]; level?: Level };

/** The suite-owned native cache and its exact lockfile. */
export type SharedToolProject = { lockfile: GeneratedFile; directory?: string };

/** Selected native projects and their sandbox command environment. */
export type SharedToolProjects = { npm?: SharedToolProject; environment: Record<string, string> };
