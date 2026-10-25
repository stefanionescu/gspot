import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { join, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { SITE_BUILD_OPTIONS } from '#tests/config/setup/programs.ts';

const { values } = parseArgs({ options: SITE_BUILD_OPTIONS });
for (const pair of values.copy ?? []) {
    const target = pair.slice(pair.indexOf('=') + 1);
    mkdirSync(dirname(target), { recursive: true });
    cpSync(pair.slice(0, pair.indexOf('=')), target, { recursive: true });
}
if (values.import !== undefined) {
    const target = values.import.slice(values.import.indexOf('=') + 1);
    const name = values.import.slice(0, values.import.indexOf('='));
    const path = createRequire(join(process.cwd(), 'package.json')).resolve(name);
    const { value } = (await import(pathToFileURL(path).href)) as { value: string };
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, value);
}
