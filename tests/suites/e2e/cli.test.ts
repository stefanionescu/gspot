import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { commitAll } from '#tests/setup/system/git.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { isOnDisk } from '#tests/setup/system/files.ts';
import type { InitJson } from '#cli/types/commands/init.ts';
import { initSandbox } from '#tests/setup/sandboxes/create.ts';
import { parseCheckReport } from '#tests/setup/cli/commands.ts';
import { readEnvironmentVariable } from '#cli/system/environment.ts';
import { getRuleFilePath } from '#tests/setup/cli/generated-files.ts';
import { createGspotProject } from '#tests/setup/sandboxes/projects/gspot.ts';
import { STARTING_FILES, SHELLCHECK_SYNTAX_FINDINGS } from '#tests/config/e2e.ts';

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
    const lockfileFindings = checks.find(({ check }) => check === 'dependencies/lockfiles')!.findings;
    const lockfile = JSON.parse(await readFile(join(root, 'package-lock.json'), 'utf8')) as {
        packages: Record<string, { resolved?: string }>;
    };
    const registry = new URL('/', readEnvironmentVariable('GSPOT_TEST_NPM_REGISTRY')).href;
    expect(lockfileFindings.map(({ file, rule, message }) => ({ file, rule, message }))).toStrictEqual(
        Object.values(lockfile.packages)
            .flatMap(({ resolved }) => (resolved?.startsWith(registry) === true ? resolved : []))
            .map((url) => ({ file: 'package-lock.json', rule: 'host', message: `${url} is not HTTPS.` })),
    );
    expect(
        checks
            .filter(({ check }) => check === 'format/prettier')
            .map(({ status, findings }) => ({ status, files: findings.map(({ file }) => file) })),
    ).toStrictEqual([{ status: 'failed', files: ['package.json', 'source.js'] }]);
    expect(checks.find(({ check }) => check === 'bash/shellcheck')).toMatchObject({
        status: 'failed',
        fileCount: 1,
        findings: SHELLCHECK_SYNTAX_FINDINGS,
    });
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
