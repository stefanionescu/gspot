import { expect, test } from 'bun:test';

import { runChecks } from '#cli/engine/run.ts';
import { openSession } from '#cli/engine/session.ts';
import { LICENSE_FILE_CASES } from '#tests/config/configurations/docs.ts';
import { LICENSE, README } from '#tests/config/setup/configurations.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildRunOptions } from '#tests/setup/cli/run.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { commitAll } from '#tests/setup/system/git.ts';

test('required files run in root and child scopes even without any Markdown file', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['docs'], { level: 'all', scopes: [{ path: 'app' }] }),
        'app/source.ts': 'export const value = 1;\n',
    });
    const { report } = await runChecks(
        await openSession(sandbox.path),
        buildRunOptions({ only: ['docs/required-files'] }),
    );
    expect(
        report.checks.map(({ scope, status, findings }) => ({
            scope,
            status,
            findings: findings.map(({ file, rule }) => ({ file, rule })),
        })),
    ).toStrictEqual([
        {
            scope: '',
            status: 'failed',
            findings: [
                { file: 'README.md', rule: 'missing-readme' },
                { file: 'LICENSE', rule: 'missing-license' },
            ],
        },
        { scope: 'app', status: 'failed', findings: [{ file: 'app/README.md', rule: 'missing-readme' }] },
    ]);
});

test.each([...LICENSE_FILE_CASES])(
    'required-files: $name counts as a LICENSE only when it is one',
    async ({ name, findings }) => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings(['docs'], { level: 'all' }),
            'README.md': README,
            [name]: LICENSE,
        });
        const found = await runSandboxCheck(sandbox.path, 'docs/required-files');
        expect(found.map(({ file, rule }) => ({ file, rule }))).toStrictEqual([...findings]);
    },
);

test('required-files: ignored README.md and LICENSE files in a Git repository are reported', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['docs'], { level: 'all' }),
        '.gitignore': 'README.md\nLICENSE\n',
        'README.md': README,
        LICENSE,
        'guide.md': 'Project documentation.\n',
    });
    commitAll(sandbox.path);
    const found = await runSandboxCheck(sandbox.path, 'docs/required-files');
    expect(found.map(({ file, rule, message }) => ({ file, rule, message }))).toStrictEqual([
        { file: 'README.md', rule: 'missing-readme', message: expect.any(String) as string },
        { file: 'LICENSE', rule: 'missing-license', message: expect.any(String) as string },
    ]);
});
