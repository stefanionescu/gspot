import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';
import { createFileTree } from 'testdirs';

import { STARTING_FILES } from '#tests/config/e2e.ts';
import { parseCheckReport } from '#tests/setup/cli/commands.ts';
import { initSandbox } from '#tests/setup/sandboxes/create.ts';
import { createGspotProject } from '#tests/setup/sandboxes/projects/gspot.ts';
import { commitAll } from '#tests/setup/system/git.ts';

test('init replaces formatter files, keeps authored notes and CLAUDE.md, and check reports findings', async () => {
    await using sandbox = await createGspotProject();
    const { root } = sandbox;
    await createFileTree(root, STARTING_FILES);
    commitAll(root);
    const initialized = await initSandbox(sandbox.online, {
        configurations: ['bash', 'python', 'swift'],
    });
    expect(initialized.stdout + initialized.stderr).not.toContain('formatter std');
    const checked = parseCheckReport(
        await sandbox.offline.run(root, [
            'check',
            '--only',
            'bash/shellcheck,dependencies/lockfiles,format/prettier',
            '--json',
        ]),
    );
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    const { checks } = checked.report;
    expect(checks.map(({ check, status }) => ({ check, status }))).toStrictEqual(
        ['bash/shellcheck', 'dependencies/lockfiles', 'format/prettier'].map((check) => ({ check, status: 'failed' })),
    );
    await writeFile(join(root, 'broken.sh'), 'echo example\n');
    const corrected = parseCheckReport(
        await sandbox.offline.run(root, ['check', '--only', 'bash/shellcheck', '--json']),
    );
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(corrected.report.checks).toMatchObject([
        { check: 'bash/shellcheck', status: 'passed', fileCount: 1, findings: [] },
    ]);
});
