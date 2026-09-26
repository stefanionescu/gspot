// The types of commands in this package.

export type SetOptions = {
    cwd: string;
    key: string;
    items: string[];
    reason?: string;
    scope?: string;
    replace: boolean;
    remove: boolean;
    toDefault: boolean;
};
export type InstallOptions = { cwd: string; isDryRun: boolean };
/** The JSON the install command prints: the planned steps of a dry run, or whether the installation completed. */
export type InstallJson = { isDryRun?: true; installed?: boolean; steps?: string[][]; hooks?: string; error?: string };
export type CommandResult = { text: string; json: unknown; exitCode: number };
/** The JSON a failed command prints: the error's name and message. */
export type CommandFailureJson = { error: string; message: string };
export type UninstallPlan = { remove: string[]; blocks: string[]; hooks: boolean };
/** gspot uninstall. */
export type UninstallOptions = { cwd: string; yes: boolean; isDryRun: boolean };
export type IgnoreOptions = {
    cwd: string;
    check: string;
    paths?: string[];
    rule?: string;
    reason?: string;
    remove: boolean;
};
export type Choice<T extends string> = { value: T; label: string; hint?: string | undefined };
export type AddOptions = { cwd: string; isDryRun: boolean; configurations: string[]; scope?: string };
export type RemoveOptions = { cwd: string; isDryRun: boolean; configuration: string; scope?: string };
