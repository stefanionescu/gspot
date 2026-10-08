export type InstallOptions = { cwd: string; isDryRun: boolean; refreshLockfiles?: boolean };

/** The JSON gspot install prints: the planned steps of a dry run, or whether the installation completed. */
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
