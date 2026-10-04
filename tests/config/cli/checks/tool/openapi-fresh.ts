export const OPENAPI_FRESH_GENERATOR = `import { readFileSync, writeFileSync } from 'node:fs';
if (process.argv[2] !== '' || process.argv[3] !== 'two words') throw new Error('Lost command arguments');
writeFileSync('openapi.json', readFileSync('schema.json'));
writeFileSync('side-effect.txt', 'Generator output');
if (readFileSync('schema.json', 'utf8').includes('fail')) {
    console.error('Generation failed');
    process.exitCode = 1;
}
`;
