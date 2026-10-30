import type { Session } from '#cli/types/session.ts';
import type { Files } from '#cli/types/system/files.ts';
import type { Tool } from '#cli/types/configurations.ts';
import type { Generation } from '#cli/types/generation/files.ts';
import type { PackageManager, PackageManagerCommand } from '#cli/types/repository/npm/package-manager.ts';

export type InstallResult = { installed: string[]; notes: string[]; steps: readonly (readonly string[])[] };

export type ToolPackageManager = PackageManager & {
    name: Exclude<PackageManager['name'], 'yarn'>;
    command: PackageManagerCommand;
};

export type ToolInstall = {
    session: Session;
    packageManager: ToolPackageManager | undefined;
    releaseAgeDays: number;
    writer: Files;
    generated: Generation;
    tools: Tool[];
    misePath: string | null;
    steps: (readonly string[])[];
};
