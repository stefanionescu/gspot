/** The result of one isolated static-site build. */
export type SiteBuild = {
    cwd: string;
    command: string[];
    folder: string;
    isBuilt: boolean;
    outputTail: string;
};

/** The PurgeCSS class: purge takes the tool file options with the stylesheets and pages to compare. */
export type PurgecssConstructor = new () => {
    purge(options: Record<string, unknown>): Promise<{ file?: string; rejected?: string[] }[]>;
};

export type PurgecssReport = { file: string; rejected: string[] }[];

export type PurgecssRequest = { toolFile: string; css: string[]; content: string[] };
