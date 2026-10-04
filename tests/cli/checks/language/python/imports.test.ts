// Prose comments between Python imports.
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/execution/session.ts';
import { buildEngineInput } from '#tests/harness/input.ts';
import { importComments } from '#cli/checks/language/python/imports/comments.ts';

test('a comment between imports is reported at its line, and imports without one are clean', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildPolicy(['python'], { level: 'all' }),
        'example/noted.py':
            '"""A test module."""\n\nimport os\n# the path tools\nimport sys\n\nVALUE = [os.sep, sys.prefix]\n',
        'example/plain.py': '"""A test module."""\n\nimport os\nimport sys\n\nVALUE = [os.sep, sys.prefix]\n',
    });
    const findings = await importComments(buildEngineInput(await openSession(sandbox.path), 'python/import-comments'));
    expect(findings.map(({ file, line, rule }) => ({ file, line, rule }))).toStrictEqual([
        { file: 'example/noted.py', line: 4, rule: 'import-comment' },
    ]);
});
