import { parseArgs } from 'node:util';

const LARGE_OUTPUT_OPTIONS = {
    text: { type: 'string' },
    count: { type: 'string' },
    exit: { type: 'string' },
    'exit-now': { type: 'boolean' },
} as const;

const { values } = parseArgs({ options: LARGE_OUTPUT_OPTIONS });
const text = (values.text ?? '').repeat(Number(values.count ?? '0'));
process.stdout.write(text);
process.stderr.write(text);
process.exitCode = Number(values.exit ?? '0');
// eslint-disable-next-line n/no-process-exit -- reason: the program stands for a tool that exits before a pipe takes its output.
if (values['exit-now'] === true) process.exit();
