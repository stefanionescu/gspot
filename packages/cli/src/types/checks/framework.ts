import type { LINKINATOR_STATES } from '#cli/config/checks/framework/site.ts';

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

/** The selected package's public LinkChecker API with CLI option delivery. */
export type LinkinatorConstructor = new () => {
    on(event: 'pagestart', listener: (url: string) => void): unknown;
    check(options: {
        path: string[];
        serverRoot: string;
        recurse: boolean;
        checkFragments: boolean;
        urlRewriteExpressions: { pattern: RegExp; replacement: string }[];
        linksToSkip: (url: string) => Promise<boolean>;
    }): Promise<
        {
            links: {
                url: string;
                state: (typeof LINKINATOR_STATES)[number];
                status?: number | null;
                parent?: string | null;
            }[];
        } & { passed: boolean }
    >;
};

export type ParsedSite = {
    build_command: string[];
    build_folder: string;
    allowed_unlisted_pages: string[];
    size_limit: { paths: string[]; kilobytes: number }[];
};
