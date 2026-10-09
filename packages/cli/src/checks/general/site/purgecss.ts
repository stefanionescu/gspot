import { z } from 'zod';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { text } from 'node:stream/consumers';
import { purgecssRequestSchema } from '#cli/parsers/schema/site.ts';
import { PROGRAM_ARGUMENT_OFFSET } from '#cli/config/platform/runtime.ts';
import type { PurgecssConstructor } from '#cli/types/checks/general/site.ts';

const executable = process.argv[PROGRAM_ARGUMENT_OFFSET];
if (executable === undefined) throw new Error('The selected PurgeCSS executable is missing.');
const api = z
    .object({ PurgeCSS: z.custom<PurgecssConstructor>((value) => typeof value === 'function') })
    .parse(await import(pathToFileURL(createRequire(executable).resolve('purgecss')).href));
const request = purgecssRequestSchema.parse(JSON.parse(await text(process.stdin)));
const configuration = z.record(z.string(), z.unknown()).parse(await import(pathToFileURL(request.configuration).href));
const report = await new api.PurgeCSS().purge({
    ...configuration,
    css: request.css,
    content: ['**/*.html', '**/*.js'],
    rejected: true,
});
process.stdout.write(`${JSON.stringify(report)}\n`);
