import { appendFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

const FIND_TEXT_OPTIONS = {
    text: { type: 'string' },
    match: { type: 'string' },
    report: { type: 'string' },
    message: { type: 'string' },
    log: { type: 'string' },
} as const;

const { values, positionals } = parseArgs({ options: FIND_TEXT_OPTIONS, allowPositionals: true });
const text = values.text ?? '';
if (values.log !== undefined) appendFileSync(values.log, `${JSON.stringify(positionals)}\n`);
const contents = await Promise.all(positionals.map(async (path) => ({ path, content: await Bun.file(path).text() })));
const found = contents.filter(({ content }) =>
    values.match === 'differs' ? content !== text : content.includes(text),
);
const reports = found.flatMap(({ path, content }) => {
    if (values.report === 'path') return [path];
    if (values.report === 'message') return [`${path}:1: ${values.message ?? ''}`];
    if (values.report !== 'line') return [];
    return content
        .split('\n')
        .flatMap((line, index) => (line.includes(text) ? [`${path}:${String(index + 1)}:${line}`] : []));
});
for (const report of reports) process.stdout.write(`${report}\n`);
process.exitCode = found.length > 0 ? 1 : 0;
