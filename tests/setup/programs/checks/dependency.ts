import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { splitPair } from '#tests/setup/system/programs.ts';
import { IMPORT_DEPENDENCY_OPTIONS } from '#tests/config/setup/programs.ts';

const { values } = parseArgs({ options: IMPORT_DEPENDENCY_OPTIONS });
const modulePath = createRequire(join(process.cwd(), 'package.json')).resolve(values.name ?? '');
const { isPassing } = (await import(pathToFileURL(modulePath).href)) as { isPassing: boolean };
await Bun.write(...splitPair(values.write ?? ''));
process.exitCode = isPassing ? 0 : 1;
