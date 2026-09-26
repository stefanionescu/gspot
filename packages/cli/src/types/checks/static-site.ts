// The types of checks/static-site in this package.

export type SizeLimit = { paths: string[]; kb: number; reason?: string };
/** The output of one isolated static-site build. */
export type SiteBuild = {
    cwd: string;
    command: string;
    output: string;
    isBuilt: boolean;
    said: string;
};
