import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { splitProgramArguments } from '#tests/setup/system/programs.ts';
import { REPORT_SWIFT_COVERAGE_OPTIONS } from '#tests/config/setup/programs.ts';

const { own, call } = splitProgramArguments();
const { values } = parseArgs({ args: own, options: REPORT_SWIFT_COVERAGE_OPTIONS });
const report = (await Bun.file(values.report ?? '').json()) as { filename: string }[];
const files = report.map((file) => ({ ...file, filename: join(process.cwd(), file.filename) }));
await Bun.write('coverage.json', JSON.stringify({ data: [{ files }] }));
if (call.includes('--show-codecov-path')) process.stdout.write(`${join(process.cwd(), 'coverage.json')}\n`);
else if (call.includes('describe')) process.stdout.write(`${values.targets ?? ''}\n`);
