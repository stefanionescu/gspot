export const OPENAPI_FRESH_GENERATOR = `import { readFileSync, writeFileSync } from 'node:fs';
if (process.argv[2] !== '' || process.argv[3] !== 'two words') throw new Error('Lost command arguments');
writeFileSync('openapi.json', readFileSync('schema.json'));
writeFileSync('side-effect.txt', 'Generator output');
if (readFileSync('schema.json', 'utf8').includes('fail')) {
    console.error('Generation failed');
    process.exitCode = 1;
}
`;

export const SPECTRAL_SCOPES = [
    ['recommended', ''],
    ['recommended', 'apps/api'],
    ['all', ''],
    ['all', 'apps/api'],
] as const;

export const SPECTRAL_RESULT = { code: 1, stderr: '', missing: false, duration: 1 };
export const SPECTRAL_FINDING = { line: 1, column: 1, rule: 'missing-schema', message: 'Missing schema' };
export const SPECTRAL_MISSING_DOCUMENT = {
    code: 2,
    stdout: '',
    stderr: 'The OpenAPI document does not exist.',
    missing: false,
    duration: 1,
};
