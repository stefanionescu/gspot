import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';
import { createFileTree } from 'testdirs';

import cliPackage from '#cli-package' with { type: 'json' };
import { initOutputSchema } from '#cli/schemas/commands.ts';
import { STARTING_FILES } from '#tests/config/e2e.ts';
import { parseCheckReport } from '#tests/setup/cli/commands.ts';
import { getRuleFilePath } from '#tests/setup/cli/generated-files.ts';
import { initSandbox } from '#tests/setup/sandboxes/create.ts';
import { createGspotProject } from '#tests/setup/sandboxes/projects/gspot.ts';
import { commitAll } from '#tests/setup/system/git.ts';

async function assertConflictingConfigs(root: string, output: string): Promise<void> {
    const { plan } = initOutputSchema.parse(JSON.parse(output));
    expect(plan.deleted).toStrictEqual([]);
    expect(plan.write.filter(({ path }) => ['prettier.config.mjs', '.editorconfig'].includes(path))).toStrictEqual([
        { path: '.editorconfig', note: expect.stringContaining('git show HEAD:.editorconfig') as string },
        { path: 'prettier.config.mjs', note: expect.stringContaining('git show HEAD:prettier.config.mjs') as string },
    ]);
    expect(existsSync(join(root, 'gspot.toml'))).toBe(true);
    expect(await readFile(join(root, 'CLAUDE.md'), 'utf8')).toBe(STARTING_FILES['CLAUDE.md']);
    const agents = await readFile(join(root, 'AGENTS.md'), 'utf8');
    expect(agents).toStartWith('# Team notes\n');
    expect(agents).toContain(getRuleFilePath('engineering', 'WORKING.md'));
}

test('the installed package carries the license notices of the packages that its bundle inlines', async () => {
    await using sandbox = await createGspotProject();
    const notices = await readFile(
        join(sandbox.root, 'node_modules', cliPackage.name, 'dist/THIRD-PARTY-NOTICES.md'),
        'utf8',
    );
    expect(notices).toContain('Permission is hereby granted');
});

test('init replaces formatter files, keeps authored notes and CLAUDE.md, and check reports findings', async () => {
    await using sandbox = await createGspotProject();
    const { root } = sandbox;
    await createFileTree(root, STARTING_FILES);
    commitAll(root);
    const initialized = await initSandbox(sandbox.online, {
        configurations: ['bash', 'python', 'swift'],
    });
    await assertConflictingConfigs(root, initialized.stdout);
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
    expect(await readFile(join(root, 'authored.txt'), 'utf8')).toBe(STARTING_FILES['authored.txt']);
});
