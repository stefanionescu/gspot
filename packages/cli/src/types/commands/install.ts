export type InstallOptions = { cwd: string; isDryRun: boolean; refreshLockfiles?: boolean };

/** The JSON the install command prints: the planned steps of a dry run, or whether the installation completed. */
export type InstallJson = {
    dryRun?: true;
    installed?: boolean;
    steps?: string[][];
    notes?: string[];
    hooks?: string;
    /** The error code of a failed installation, as every failure JSON names it. */
    error?: 'installation';
    message?: string;
};
