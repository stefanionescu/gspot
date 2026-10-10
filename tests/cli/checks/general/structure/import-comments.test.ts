import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/commands/public.ts';
import { checkReport } from '#tests/harness/gspot.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { buildCheckInput } from '#tests/harness/input.ts';
import { BUILT_IN_CALCULATIONS } from '#cli/checks/public.ts';

test('Swift import runs report an intervening comment and accept moving it above the imports', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildPolicy(['swift'], { level: 'all' }),
        'Noted.swift': 'import Foundation\n// The interface configuration.\nimport UIKit\n',
    });
    const failed = await checkReport(sandbox.path, ['check', '--only', 'structure/import-comments', '--json']);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect(failed.report.checks).toMatchObject([
        {
            check: 'structure/import-comments',
            status: 'failed',
            findings: [{ file: 'Noted.swift', rule: 'import-comment', line: 2 }],
        },
    ]);
    await Bun.write(
        `${sandbox.path}/Noted.swift`,
        '// The interface configuration.\nimport Foundation\nimport UIKit\n',
    );
    const corrected = await checkReport(sandbox.path, ['check', '--only', 'structure/import-comments', '--json']);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(corrected.report.checks).toMatchObject([{ status: 'passed', findings: [] }]);
});

test('a comment between imports is reported at its line, and imports without one are clean', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildPolicy(['python'], { level: 'all' }),
        'example/noted.py':
            '"""A test module."""\n\nimport os\n# the path tools\nimport sys\n\nVALUE = [os.sep, sys.prefix]\n',
        'example/plain.py': '"""A test module."""\n\nimport os\nimport sys\n\nVALUE = [os.sep, sys.prefix]\n',
    });
    const findings = await BUILT_IN_CALCULATIONS['structure/import-comments'](
        buildCheckInput(await openSession(sandbox.path), 'structure/import-comments'),
    );
    expect(findings.map(({ file, line, rule }) => ({ file, line, rule }))).toStrictEqual([
        { file: 'example/noted.py', line: 4, rule: 'import-comment' },
    ]);
});
