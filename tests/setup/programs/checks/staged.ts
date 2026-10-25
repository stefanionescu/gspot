import { statSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { EXECUTABLE_BITS, CHECK_STAGED_COPY_OPTIONS } from '#tests/config/setup/programs.ts';

const { values } = parseArgs({ options: CHECK_STAGED_COPY_OPTIONS });
const [created = '', text = ''] = (values.write ?? '').split('=');
await Bun.write(created, text);
const bytes = Buffer.from(await Bun.file(values.payload ?? '').arrayBuffer());
const isExecutable = process.platform === 'win32' || (statSync(values.executable ?? '').mode & EXECUTABLE_BITS) !== 0;
process.exitCode = bytes.equals(Buffer.from(values.bytes ?? '', 'hex')) && isExecutable ? 0 : 1;
