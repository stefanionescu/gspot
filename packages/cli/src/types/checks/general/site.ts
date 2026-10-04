export type SizeLimit = { paths: string[]; kb: number; reason?: string };

/** The output of one isolated static-site build. */
export type SiteBuild = {
    cwd: string;
    command: string;
    output: string;
    isBuilt: boolean;
    outputTail: string;
};

/** A reasoned URL pattern omitted from external link checking. */
export type LinkExclusion = { pattern?: string; reason?: string };
