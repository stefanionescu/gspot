import type { Session } from '#cli/types/session.ts';
import type { Files } from '#cli/types/system/files.ts';
import type { Tool } from '#cli/types/configurations.ts';
import type { GenerationResult } from '#cli/types/generation/files.ts';
import type { PackageManager, PackageManagerCommand } from '#cli/types/repository/npm/package-manager.ts';

export type InstallResult = { note: string; steps: readonly (readonly string[])[] };

export type ToolPackageManager = PackageManager & { command: PackageManagerCommand };

export type MinimumReleaseAge = { days: number; npmExclusions: string[]; pythonExclusions: string[] };

export type ToolInstall = {
    session: Session;
    packageManager: ToolPackageManager | undefined;
    minimumReleaseAge: MinimumReleaseAge;
    writer: Files;
    generated: GenerationResult;
    tools: Tool[];
    misePath: string | null;
    steps: (readonly string[])[];
};
