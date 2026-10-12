import { z } from 'zod';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { text } from 'node:stream/consumers';
import type { SchemaShape } from '#cli/types/objects.ts';
import type { PurgecssConstructor } from '#cli/types/checks/framework.ts';
import { PURGECSS, PURGECSS_CONTENT } from '#cli/config/checks/framework/site.ts';

/** The selected PurgeCSS child's configuration and stylesheet paths. */
const purgecssRequestSchema = z.strictObject({
    configuration: z.string().min(1),
    css: z.array(z.string().min(1)).min(1),
} satisfies SchemaShape<{ configuration: string; css: string[] }>);
const executable = z.string().parse(process.argv[2]);
const api = (await import(pathToFileURL(createRequire(executable).resolve(PURGECSS)).href)) as {
    PurgeCSS: PurgecssConstructor;
};
const request = purgecssRequestSchema.parse(JSON.parse(await text(process.stdin)));
const configuration = (await import(pathToFileURL(request.configuration).href)) as Record<string, unknown>;
const report = await new api.PurgeCSS().purge({
    ...configuration,
    css: request.css,
    content: PURGECSS_CONTENT,
    rejected: true,
});
process.stdout.write(`${JSON.stringify(report)}\n`);
