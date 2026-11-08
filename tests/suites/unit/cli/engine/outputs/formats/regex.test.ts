import { expect, test } from 'bun:test';

import { parseOutput } from '#cli/engine/outputs/formats.ts';
import { outputSchema } from '#cli/schemas/manifests/checks.ts';
import { FIXABLE_FORMAT_CASES } from '#tests/config/engine/outputs.ts';
import { BASE_CHECK } from '#tests/config/engine/tool-runs.ts';
import { getShippedCheck } from '#tests/setup/cli/manifests.ts';

test('a fixed regex message needs an explicit fixable pattern to offer a fix', () => {
    const output = outputSchema.parse({ format: 'regex', pattern: '^(?<file>.+)$', message: 'Needs attention.' });
    const check = { ...BASE_CHECK, output, fix: ['formatter'] };
    const paths = { root: '/repo', cwd: '/repo' };
    expect(parseOutput(check, 'source.ts', '', paths)).toStrictEqual([
        { check: check.id, file: 'source.ts', message: 'Needs attention.', help: check.help, fixable: false },
    ]);
    expect(parseOutput({ ...check, output: { ...output, fixable: '^source' } }, 'source.ts', '', paths)).toStrictEqual([
        { check: check.id, file: 'source.ts', message: 'Needs attention.', help: check.help, fixable: true },
    ]);
});

test.each([...FIXABLE_FORMAT_CASES])('the %s formatter declares which output supports fixing', (name, stdout, file) => {
    const check = getShippedCheck(name);
    expect(parseOutput(check, stdout, '', { root: '/repo', cwd: '/repo' })).toMatchObject([{ file, fixable: true }]);
});
