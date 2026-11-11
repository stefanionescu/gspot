import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

import { splitAssignment } from '#tests/setup/system/programs.ts';

const IMPORT_DEPENDENCY_OPTIONS = { name: { type: 'string' }, write: { type: 'string' } } as const;

const { values } = parseArgs({ options: IMPORT_DEPENDENCY_OPTIONS });
const modulePath = createRequire(join(process.cwd(), 'package.json')).resolve(values.name ?? '');
const { isPassing } = (await import(pathToFileURL(modulePath).href)) as { isPassing: boolean };
await Bun.write(...splitAssignment(values.write ?? ''));
process.exitCode = isPassing ? 0 : 1;
