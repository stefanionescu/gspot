// The types of commands/install in this package.
import type { Manifest } from '#cli/types/kits.ts';
import type { Session } from '#cli/types/tools/tools.ts';

export type InstallOptions = { cwd: string; isDryRun: boolean };

/** The JSON the install command prints: the planned steps of a dry run, or whether the installation completed. */
export type InstallJson = {
    dryRun?: true;
    installed?: boolean;
    steps?: string[][];
    hooks?: string;
    /** The error code of a failed installation, as every failure JSON names it. */
    error?: 'installation';
    message?: string;
};

/** One independently attempted installation phase and its non-Error failure text. */
export type InstallationStep = {
    failure: string;
    run: (session: Session, manifests: Manifest[]) => string | Promise<string>;
};

/** What an installation after a write said, and the exit code it leaves. */
export type Installed = { installNote: string; exitCode: number };
