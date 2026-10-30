import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { parseOutput } from '#cli/runs/output/formats.ts';
import { getShippedCheck } from '#tests/setup/cli/manifests.ts';

test('a Knip report with an export name that is not text is refused', async () => {
    const check = getShippedCheck('javascript/knip');
    const stdout = '{"issues":[{"file":"source.js","exports":[{"name":1}]}]}';

    await using sandbox = await testdir();
    expect(() => parseOutput(check, stdout, '', { root: sandbox.path, cwd: sandbox.path })).toThrow(
        new Error('Knip printed output that gspot cannot read.'),
    );
});

test('grouped duplicate exports retain every symbol position and namespace', async () => {
    const check = getShippedCheck('javascript/knip');
    await using sandbox = await testdir();
    const stdout =
        '{"issues":[{"file":"src/a.ts","duplicates":[[{"name":"a","namespace":"ns","line":2,"col":3},{"name":"b","namespace":"ns","line":4,"col":5}]]}]}';
    const findings = parseOutput(check, stdout, '', { root: sandbox.path, cwd: sandbox.path });
    expect(findings.map(({ message, line, column }) => ({ message, line, column }))).toStrictEqual([
        { message: 'Duplicate export: a, b (ns)', line: 2, column: 3 },
        { message: 'Duplicate export: a, b (ns)', line: 4, column: 5 },
    ]);
});
