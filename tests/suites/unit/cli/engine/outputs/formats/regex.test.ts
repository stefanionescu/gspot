import { expect, test } from 'bun:test';

import { parseOutput } from '#cli/engine/outputs/formats.ts';
import { outputSchema } from '#cli/schemas/manifests/checks.ts';
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

test('the python/ruff-format formatter declares which output supports fixing', () => {
    const check = getShippedCheck('python/ruff-format');
    expect(
        parseOutput(check, 'source.py:1:1: unformatted: different spacing', '', { root: '/repo', cwd: '/repo' }),
    ).toMatchObject([{ file: 'source.py', fixable: true }]);
});
