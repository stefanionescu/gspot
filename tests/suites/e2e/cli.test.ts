import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { STARTING_FILES } from '#tests/config/e2e.ts';
import { commitAll } from '#tests/setup/system/git.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { isOnDisk } from '#tests/setup/system/files.ts';
import type { InitJson } from '#cli/types/commands/edits.ts';
import { initSandbox } from '#tests/setup/sandboxes/create.ts';
import { parseCheckReport } from '#tests/setup/cli/commands.ts';
import { getRuleFilePath } from '#tests/setup/cli/generated-files.ts';
import { createGspotProject } from '#tests/setup/sandboxes/projects/gspot.ts';

async function assertConflictingConfigs(root: string, output: string): Promise<void> {
    const { plan } = JSON.parse(output) as InitJson;
    expect(plan.delete).toStrictEqual([]);
    expect(plan.write.filter(({ path }) => ['prettier.config.mjs', '.editorconfig'].includes(path))).toStrictEqual([
        { path: '.editorconfig', note: 'replaces your file; read the old one with git show HEAD:.editorconfig' },
        {
            path: 'prettier.config.mjs',
            note: 'replaces your file; read the old one with git show HEAD:prettier.config.mjs; gspot cannot read this Prettier config, so set format.indent_width and format.print_width by hand',
        },
    ]);
    expect(await isOnDisk(join(root, 'gspot.toml'))).toBe(true);
    expect(await readFile(join(root, 'CLAUDE.md'), 'utf8')).toBe(STARTING_FILES['CLAUDE.md']);
    const agents = await readFile(join(root, 'AGENTS.md'), 'utf8');
    expect(agents).toStartWith('# Team notes\n');
    expect(agents).toContain(getRuleFilePath('engineering', 'WORKING.md'));
}

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
