import { expect, test } from 'bun:test';

import { parseOutput } from '#cli/engine/outputs/formats.ts';
import { outputSchema } from '#cli/schemas/manifests/checks.ts';
import { BRACKETED_WORD_FINDINGS, FIXABLE_FORMAT_CASES } from '#tests/config/engine/outputs.ts';
import { BASE_CHECK } from '#tests/config/engine/tool-runs.ts';
import { getShippedCheck } from '#tests/setup/cli/manifests.ts';

test('a regex finding without a rule group keeps a trailing bracketed word in its message', () => {
    const check = { ...BASE_CHECK, output: outputSchema.parse({ format: 'regex' }) };
    const paths = { root: '/repository', cwd: '/repository' };
    expect(
        parseOutput(
            check,
            'a.txt:1: Call the function by its full name (fetch)\nb.txt:2: Name the type [User]\n',
            '',
            paths,
        ),
    ).toStrictEqual([...BRACKETED_WORD_FINDINGS]);
    const pytest = getShippedCheck('pytest/tests');
    expect(
        parseOutput(pytest, 'FAILED tests/test_total.py::test_sum - assert total(items) == expected(items)', '', paths),
    ).toStrictEqual([
        {
            check: 'pytest/tests',
            file: 'tests/test_total.py',
            message: 'FAILED tests/test_total.py::test_sum - assert total(items) == expected(items)',
            help: pytest.help,
            fixable: false,
        },
    ]);
});

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
