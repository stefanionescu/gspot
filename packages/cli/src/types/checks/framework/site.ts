export type SiteBuild = {
    cwd: string;
    command: string[];
    folder: string;
    isBuilt: boolean;
    failure: string;
};

export type PurgecssConstructor = new () => {
    purge(options: Record<string, unknown>): Promise<{ file?: string; rejected?: string[] }[]>;
};

export type PurgecssReport = { file: string; rejected: string[] }[];

export type PurgecssRequest = { configFile: string; css: string[]; content: string[] };
