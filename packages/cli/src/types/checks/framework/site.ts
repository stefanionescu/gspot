/** The result of one isolated static-site build. */
export type SiteBuild = {
    cwd: string;
    command: string[];
    folder: string;
    isBuilt: boolean;
    /** Why the build wrote no site: the output of a failed command, or the folder it did not write. */
    failure: string;
};

/** The PurgeCSS class: purge takes the config file options with the stylesheets and pages to compare. */
export type PurgecssConstructor = new () => {
    purge(options: Record<string, unknown>): Promise<{ file?: string; rejected?: string[] }[]>;
};

export type PurgecssReport = { file: string; rejected: string[] }[];

export type PurgecssRequest = { configFile: string; css: string[]; content: string[] };
