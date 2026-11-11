import { readFile, writeFile } from 'node:fs/promises';
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
    expect(await readFile(join(root, 'prettier.config.mjs'), 'utf8')).not.toBe(STARTING_FILES['prettier.config.mjs']);
    expect(await readFile(join(root, 'AGENTS.md'), 'utf8')).toStartWith(STARTING_FILES['AGENTS.md']);
    expect({
        claude: await readFile(join(root, 'CLAUDE.md'), 'utf8'),
        authored: await readFile(join(root, 'authored.txt'), 'utf8'),
    }).toStrictEqual({ claude: STARTING_FILES['CLAUDE.md'], authored: STARTING_FILES['authored.txt'] });
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
    expect(new Set(checks[0]!.findings.map(({ file }) => file))).toStrictEqual(new Set(['broken.sh']));
    await writeFile(join(root, 'broken.sh'), 'echo example\n');
    const corrected = parseCheckReport(
        await sandbox.offline.run(root, ['check', '--only', 'bash/shellcheck', '--json']),
    );
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(corrected.report.checks).toMatchObject([
        { check: 'bash/shellcheck', status: 'passed', fileCount: 1, findings: [] },
    ]);
});
