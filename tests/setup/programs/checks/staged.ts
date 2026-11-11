import { statSync } from 'node:fs';
import { parseArgs } from 'node:util';

import { EXECUTABLE_BITS } from '#cli/config/repository/files.ts';
import { splitAssignment } from '#tests/setup/system/programs.ts';

const CHECK_STAGED_COPY_OPTIONS = {
    file: { type: 'string' },
    bytes: { type: 'string' },
    executable: { type: 'string' },
    write: { type: 'string' },
} as const;

const { values } = parseArgs({ options: CHECK_STAGED_COPY_OPTIONS });
await Bun.write(...splitAssignment(values.write ?? ''));
const bytes = Buffer.from(await Bun.file(values.file ?? '').arrayBuffer());
const isExecutable = process.platform === 'win32' || (statSync(values.executable ?? '').mode & EXECUTABLE_BITS) !== 0;
process.exitCode = isExecutable && bytes.equals(Buffer.from(values.bytes ?? '', 'hex')) ? 0 : 1;
