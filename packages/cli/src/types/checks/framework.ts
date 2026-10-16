/** The result of one isolated static-site build. */
export type SiteBuild = {
    cwd: string;
    command: string[];
    folder: string;
    isBuilt: boolean;
    outputTail: string;
};

/** The selected native package's public LinkChecker API with native CLI option delivery. */
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
                state: 'BROKEN' | 'OK' | 'SKIPPED';
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
