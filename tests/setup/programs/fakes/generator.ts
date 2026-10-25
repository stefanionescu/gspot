import { readFileSync, writeFileSync } from 'node:fs';

const [output = ''] = process.argv.slice(2);
const state = readFileSync('schema.txt', 'utf8');
writeFileSync(output, state);
process.stdout.write(`${state}\n`);
if (state === 'failure') {
    process.stderr.write('Generation failed\n');
    process.exitCode = 1;
}
