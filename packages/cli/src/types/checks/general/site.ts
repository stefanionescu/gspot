import type { z } from 'zod';
import type { linkinatorReportSchema } from '#cli/parsers/schema/site.ts';

/** The output of one isolated static-site build. */
export type SiteBuild = {
    cwd: string;
    command: string[];
    output: string;
    isBuilt: boolean;
    outputTail: string;
};

/** Configuration read by the selected package's public getConfig API. */
export type LinkinatorFlags = {
    concurrency?: number | undefined;
    sitemap?: boolean | string | string[] | undefined;
    sitemapUrl?: string | string[] | undefined;
    timeout?: number | undefined;
    markdown?: boolean | undefined;
    checkCss?: boolean | undefined;
    directoryListing?: boolean | undefined;
    cleanUrls?: boolean | undefined;
    redirects?: 'allow' | 'warn' | 'error' | undefined;
    requireHttps?: 'off' | 'warn' | 'error' | undefined;
    allowInsecureCerts?: boolean | undefined;
    retry?: boolean | undefined;
    retryErrors?: boolean | undefined;
    userAgent?: string | undefined;
    header?: string[] | undefined;
    skipFragment?: string | string[] | undefined;
    urlRewriteExpressions?: { pattern: string | RegExp; replacement: string }[] | undefined;
    urlRewriteSearch?: string | undefined;
    urlRewriteReplace?: string | undefined;
    statusCodes?: Record<string, string> | undefined;
    statusCode?: string | string[] | undefined;
};

/** The selected native package's public LinkChecker API with native CLI option delivery. */
export type LinkinatorConstructor = new () => {
    on(event: 'pagestart', listener: (url: string) => void): unknown;
    check(
        options: Omit<LinkinatorFlags, 'urlRewriteExpressions' | 'sitemap'> & {
            sitemap: LinkinatorFlags['sitemap'];
            path: string[];
            serverRoot: string;
            recurse: boolean;
            checkFragments: boolean;
            headers: Record<string, string>;
            fragmentsToSkip: string[];
            urlRewriteExpressions: { pattern: RegExp; replacement: string }[];
            linksToSkip: (url: string) => Promise<boolean>;
        },
    ): Promise<z.infer<typeof linkinatorReportSchema> & { passed: boolean }>;
};

/** Read the selected native package's default CLI configuration. */
export type LinkinatorOptionsReader = (flags: Record<string, never>) => Promise<LinkinatorFlags>;

/** The selected native PurgeCSS package's public analysis API. */
export type PurgecssConstructor = new () => {
    purge(options: Record<string, unknown>): Promise<unknown>;
};
