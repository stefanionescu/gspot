import { z } from 'zod';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { text } from 'node:stream/consumers';
import type { SchemaShape } from '#cli/types/shapes.ts';
import type { LinkinatorConstructor } from '#cli/types/checks/framework.ts';
import { LINKINATOR, LOCAL_HOSTS } from '#cli/config/checks/framework/site.ts';

/** The request that the parent process sends on stdin. */
const linkinatorRequestSchema = z.strictObject({
    paths: z.array(z.string().min(1)),
    origin: z.url().optional(),
    skipped: z.array(z.string()),
} satisfies SchemaShape<{ paths: string[]; origin?: string | undefined; skipped: string[] }>);
const executable = z.string().parse(process.argv[2]);
const api = (await import(pathToFileURL(createRequire(executable).resolve(LINKINATOR)).href)) as {
    LinkChecker: LinkinatorConstructor;
};
const request = linkinatorRequestSchema.parse(JSON.parse(await text(process.stdin)));
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
    path: request.paths.length === 0 ? ['.'] : request.paths,
    serverRoot: process.cwd(),
    recurse: true,
    checkFragments: true,
    urlRewriteExpressions: rewrites,
    linksToSkip: (href) => {
        const url = new URL(href);
        return Promise.resolve(
            (url.origin !== request.origin && !LOCAL_HOSTS.has(url.hostname)) ||
                skipped.some((pattern) => pattern.test(href)),
        );
    },
});
process.stdout.write(`${JSON.stringify(result)}\n`);
process.exitCode = result.passed ? 0 : 1;
