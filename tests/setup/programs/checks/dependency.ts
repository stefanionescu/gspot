import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { IMPORT_DEPENDENCY_OPTIONS } from '#tests/config/setup/programs.ts';

const { values } = parseArgs({ options: IMPORT_DEPENDENCY_OPTIONS });
const modulePath = createRequire(join(process.cwd(), 'package.json')).resolve(values.name ?? '');
const { isPassing } = (await import(pathToFileURL(modulePath).href)) as { isPassing: boolean };
await Bun.write(
    ...([
        (values.write ?? '').slice(0, (values.write ?? '').indexOf('=')),
        (values.write ?? '').slice((values.write ?? '').indexOf('=') + 1),
    ] as const),
);
process.exitCode = isPassing ? 0 : 1;
