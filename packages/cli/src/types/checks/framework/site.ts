import type { CheckFinding } from '#cli/types/runs/check.ts';

export type SitemapUrls = { urls: URL[]; findings: CheckFinding[] };

export type SiteBuild = {
    cwd: string;
    command: string[];
    folder: string;
    built: boolean;
    failure: string;
};

export type PurgecssConstructor = new () => {
    purge(options: Record<string, unknown>): Promise<{ file?: string; rejected?: string[] }[]>;
};

export type PurgecssOutput = { file: string; rejected: string[] }[];

export type PurgecssRequest = { configFile: string; css: string[]; content: string[] };
