import type { Settings } from '#cli/types/settings/file.ts';
import type { FROZEN_INSTALLS } from '#cli/config/generation/ci.ts';
import type { PackageManager } from '#cli/types/repository/npm/package-manager.ts';

export type ActionPin = { name: string; sha: string; version: string };

export type Pipeline = {
    version: string;
    packageManager?: PackageManager | undefined;
    packageManagers: CiPackageManager[];
    setupCommand?: NonNullable<Settings['ci']>['setup_command'];
    projectInstall: string[];
    operatingSystems: NonNullable<Settings['ci']>['operating_systems'];
    linuxRunner: NonNullable<Settings['ci']>['linux_runner'];
    lockfiles: string[];
    hasSwift: boolean;
};

export type FrozenLockfile = keyof typeof FROZEN_INSTALLS;

export type CiPackageManager = (typeof FROZEN_INSTALLS)[FrozenLockfile][0];
