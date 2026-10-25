import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { text } from 'node:stream/consumers';
import { PURGECSS_TOOL } from '#cli/config/checks/framework/site/purgecss-process.ts';
import type { PurgecssRequest, PurgecssConstructor } from '#cli/types/checks/framework/site.ts';

const executable = process.argv[2] as string;
const api = (await import(pathToFileURL(createRequire(executable).resolve(PURGECSS_TOOL)).href)) as {
    PurgeCSS: PurgecssConstructor;
};
const request = JSON.parse(await text(process.stdin)) as PurgecssRequest;
const options = (await import(pathToFileURL(request.configFile).href)) as Record<string, unknown>;
const results = await new api.PurgeCSS().purge({
    ...options,
    css: request.css,
    content: request.content,
    rejected: true,
});
process.stdout.write(`${JSON.stringify(results)}\n`);
