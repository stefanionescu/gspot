// The PurgeCSS command imports its tool file by a bare path, which Node refuses on Windows. Import it by URL instead.
import { z } from 'zod';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { text } from 'node:stream/consumers';
import type { SchemaShape } from '#cli/types/shapes.ts';
import { PURGECSS } from '#cli/config/checks/framework/site.ts';
import type { PurgecssConstructor } from '#cli/types/checks/framework.ts';

/** The request that the parent process sends on stdin. */
const purgecssRequestSchema = z.strictObject({
    toolFile: z.string().min(1),
    css: z.array(z.string().min(1)),
    content: z.array(z.string().min(1)),
} satisfies SchemaShape<{ toolFile: string; css: string[]; content: string[] }>);
const executable = z.string().parse(process.argv[2]);
const api = (await import(pathToFileURL(createRequire(executable).resolve(PURGECSS)).href)) as {
    PurgeCSS: PurgecssConstructor;
};
const request = purgecssRequestSchema.parse(JSON.parse(await text(process.stdin)));
const options = (await import(pathToFileURL(request.toolFile).href)) as Record<string, unknown>;
const results = await new api.PurgeCSS().purge({
    ...options,
    css: request.css,
    content: request.content,
    rejected: true,
});
process.stdout.write(`${JSON.stringify(results)}\n`);
