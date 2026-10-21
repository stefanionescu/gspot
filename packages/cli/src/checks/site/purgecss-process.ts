// The PurgeCSS command imports its tool file by a bare path, which Node refuses on Windows. Import it by URL instead.

import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { text } from 'node:stream/consumers';
import { PURGECSS } from '#cli/config/checks/site.ts';
import type { PurgecssConstructor } from '#cli/types/checks/site.ts';
import { purgecssRequestSchema, processArgumentSchema } from '#cli/schemas/checks/site/purgecss-process.ts';

const executable = processArgumentSchema.parse(process.argv[2]);
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
