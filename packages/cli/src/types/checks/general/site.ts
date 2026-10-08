/** The output of one isolated static-site build. */
export type SiteBuild = {
    cwd: string;
    command: string[];
    output: string;
    isBuilt: boolean;
    outputTail: string;
};
