import { statSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { EXECUTABLE_BITS } from '#cli/config/repository/files/tracked.ts';
import { CHECK_STAGED_COPY_OPTIONS } from '#tests/config/setup/programs.ts';

const { values } = parseArgs({ options: CHECK_STAGED_COPY_OPTIONS });
await Bun.write(
    ...([
        (values.write ?? '').slice(0, (values.write ?? '').indexOf('=')),
        (values.write ?? '').slice((values.write ?? '').indexOf('=') + 1),
    ] as const),
);
const bytes = Buffer.from(await Bun.file(values.file ?? '').arrayBuffer());
const isExecutable = process.platform === 'win32' || (statSync(values.executable ?? '').mode & EXECUTABLE_BITS) !== 0;
process.exitCode = bytes.equals(Buffer.from(values.bytes ?? '', 'hex')) && isExecutable ? 0 : 1;
