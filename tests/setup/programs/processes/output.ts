import { parseArgs } from 'node:util';
import { LARGE_OUTPUT_OPTIONS } from '#tests/config/setup/programs.ts';

const { values } = parseArgs({ options: LARGE_OUTPUT_OPTIONS });
const text = (values.text ?? '').repeat(Number(values.count ?? '0'));
process.stdout.write(text);
process.stderr.write(text);
process.exitCode = Number(values.exit ?? '0');
