import { z } from 'zod';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { text } from 'node:stream/consumers';
import { linkinatorRequestSchema } from '#cli/parsers/schema/site.ts';
import { PROGRAM_ARGUMENT_OFFSET } from '#cli/config/platform/runtime.ts';
import { LINKINATOR_STATUS_ACTIONS } from '#cli/config/checks/general/site.ts';
import type { LinkinatorConstructor, LinkinatorOptionsReader } from '#cli/types/checks/general/site.ts';

const apiSchema = z.object({
    LinkChecker: z.custom<LinkinatorConstructor>((value) => typeof value === 'function'),
    getConfig: z.custom<LinkinatorOptionsReader>((value) => typeof value === 'function'),
});
const executable = process.argv[PROGRAM_ARGUMENT_OFFSET];
if (executable === undefined) throw new Error('The selected Linkinator executable is missing.');
const entry = createRequire(executable).resolve('linkinator');
const api = apiSchema.parse(await import(pathToFileURL(entry).href));
const request = linkinatorRequestSchema.parse(JSON.parse(await text(process.stdin)));
const flags = await api.getConfig({});
const headers = Object.fromEntries(
    (flags.header ?? []).map((item) => {
        const colon = item.indexOf(':');
        if (colon === -1) throw new Error(`Invalid header format: "${item}". Use "Header-Name:value" format.`);
        const key = item.slice(0, colon).trim();
        const value = item.slice(colon + 1).trim();
        if (key === '') throw new Error(`Invalid header format: "${item}". Header name cannot be empty.`);
        if (value === '') throw new Error(`Invalid header format: "${item}". Header value cannot be empty.`);
        return [key, value];
    }),
);
const fragments: string[] = [];
if (typeof flags.skipFragment === 'string') fragments.push(flags.skipFragment);
else if (Array.isArray(flags.skipFragment)) fragments.push(...flags.skipFragment);
let configuredRewrites =
    flags.urlRewriteExpressions?.map(({ pattern, replacement }) => ({
        pattern: pattern instanceof RegExp ? pattern : new RegExp(pattern),
        replacement,
    })) ?? [];
if (
    flags.urlRewriteSearch !== undefined &&
    flags.urlRewriteSearch !== '' &&
    flags.urlRewriteReplace !== undefined &&
    flags.urlRewriteReplace !== ''
)
    configuredRewrites = [{ pattern: new RegExp(flags.urlRewriteSearch), replacement: flags.urlRewriteReplace }];
const statuses = { ...flags.statusCodes };
for (const item of typeof flags.statusCode === 'string' ? [flags.statusCode] : (flags.statusCode ?? [])) {
    const colon = item.indexOf(':');
    if (colon === -1)
        throw new Error(`Invalid status-code format: "${item}". Use "CODE:ACTION" format (e.g., "403:warn").`);
    const code = item.slice(0, colon).trim();
    const action = item.slice(colon + 1).trim();
    if (code === '') throw new Error(`Invalid status-code format: "${item}". Status code cannot be empty.`);
    if (!LINKINATOR_STATUS_ACTIONS.includes(action))
        throw new Error(`Invalid status-code action: "${action}". Must be one of: ok, warn, skip, error.`);
    statuses[code] = action;
}
const skipped = request.skipped.map((pattern) => new RegExp(pattern));
const rewrites =
    request.origin === undefined
        ? []
        : [{ pattern: new RegExp(`^${RegExp.escape(request.origin)}(?=/|$)`), replacement: request.origin }];
const checker = new api.LinkChecker();
checker.on('pagestart', (url) => {
    for (const rewrite of rewrites) rewrite.replacement = new URL(url).origin;
});
const result = await checker.check({
    markdown: flags.markdown,
    checkCss: flags.checkCss,
    directoryListing: flags.directoryListing,
    cleanUrls: flags.cleanUrls,
    redirects: flags.redirects,
    requireHttps: flags.requireHttps,
    allowInsecureCerts: flags.allowInsecureCerts,
    retry: flags.retry,
    retryErrors: flags.retryErrors,
    userAgent: flags.userAgent,
    timeout: Number(flags.timeout),
    concurrency: Number(flags.concurrency),
    sitemap: flags.sitemapUrl ?? flags.sitemap,
    headers,
    fragmentsToSkip: fragments.flatMap((pattern) => pattern.split(/[\s,]+/u).filter(Boolean)),
    statusCodes: statuses,
    path: request.paths.length === 0 ? ['.'] : request.paths,
    serverRoot: process.cwd(),
    recurse: true,
    checkFragments: true,
    urlRewriteExpressions: [...configuredRewrites, ...rewrites],
    linksToSkip: (href) => {
        const url = new URL(href);
        return Promise.resolve(
            (!request.external &&
                url.origin !== request.origin &&
                url.hostname !== 'localhost' &&
                url.hostname !== '127.0.0.1') ||
                skipped.some((pattern) => pattern.test(href)),
        );
    },
});
process.stdout.write(`${JSON.stringify(result)}\n`);
process.exitCode = result.passed ? 0 : 1;
