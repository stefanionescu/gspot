import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { commitAll } from '#tests/setup/system/git.ts';
import { isOnDisk } from '#tests/setup/system/files.ts';
import type { InitJson } from '#cli/types/commands/init.ts';
import type { GspotProject } from '#tests/types/packages.ts';
import { runCommand } from '#tests/setup/system/processes.ts';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { initSandbox } from '#tests/setup/sandboxes/create.ts';
import { parseCheckReport } from '#tests/setup/cli/commands.ts';
import { readEnvironmentVariable } from '#cli/system/environment.ts';
import { createGspotProject } from '#tests/setup/sandboxes/projects/gspot.ts';
import { generateFile, findRuleFilePath } from '#tests/setup/cli/generated-files.ts';
import { STARTING_FILES, SHELLCHECK_SYNTAX_FINDINGS } from '#tests/config/e2e/cli.ts';

async function assertConflictingConfigFiles(root: string, output: string): Promise<void> {
    const { plan } = JSON.parse(output) as InitJson;
    expect(plan.delete).toStrictEqual([]);
    expect(plan.write.filter(({ path }) => ['prettier.config.mjs', '.editorconfig'].includes(path))).toStrictEqual([
        { path: '.editorconfig', note: 'replaces your file; read the old one with git show HEAD:.editorconfig' },
        {
            path: 'prettier.config.mjs',
            note: 'replaces your file; read the old one with git show HEAD:prettier.config.mjs; gspot cannot read a JavaScript Prettier config, so set format.indent_width and format.print_width by hand',
        },
    ]);
    expect(await isOnDisk(join(root, 'gspot.toml'))).toBe(true);
    const settings = await readFile(join(root, 'gspot.toml'), 'utf8');
    expect(await readFile(join(root, 'prettier.config.mjs'), 'utf8')).toBe(
        await generateFile(settings, 'prettier.config.mjs', {}),
    );
    expect(await readFile(join(root, 'CLAUDE.md'), 'utf8')).toBe(STARTING_FILES['CLAUDE.md']);
    const agents = await readFile(join(root, 'AGENTS.md'), 'utf8');
    expect(agents).toStartWith('# Team notes\n');
    expect(agents).toContain(findRuleFilePath('engineering', 'WORKING.md'));
}

test('init replaces formatter files, keeps your notes and CLAUDE.md, and check reports findings', async () => {
    await using sandbox = await createGspotProject();
    const { root } = sandbox;
    await createFileTree(root, STARTING_FILES);
    commitAll(root);
    const initialized = await initSandbox(sandbox.online, {
        configurations: ['bash', 'python', 'swift'],
    });
    await assertConflictingConfigFiles(root, initialized.stdout);
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

async function prepareFormatterSandbox(installation: GspotProject) {
    const toolConsumer = join(installation.workspace, 'tool-consumer');
    await mkdir(toolConsumer);
    const bun = await runCommand(['bun', '--version'], { cwd: toolConsumer, env: installation.environment });
    if (bun.code !== 0) throw new Error(`Bun version failed: ${bun.stdout}${bun.stderr}`);
    const authoredPackage = JSON.stringify({
        private: true,
        packageManager: `bun@${bun.stdout.trim()}`,
        scripts: { test: 'authored-command' },
    });
    await writeFile(join(toolConsumer, 'package.json'), authoredPackage);
    await writeFile(join(toolConsumer, 'source.js'), 'export const greeting="hello";');
    commitAll(toolConsumer);
    const consumerSandbox = { ...installation.online, root: toolConsumer };
    await initSandbox(consumerSandbox, { configurations: ['format'], level: 'all' });
    return { consumerSandbox, authoredPackage };
}

test('the installed formatter reports and fixes source and keeps your package.json fields', async () => {
    await using consumer = await createGspotProject();
    const { consumerSandbox, authoredPackage } = await prepareFormatterSandbox(consumer);
    const formatter = ['check', 'source.js', '--only', 'format/prettier', '--json'];
    const invalid = parseCheckReport(await consumerSandbox.run(consumerSandbox.root, formatter));
    expect(invalid.code, invalid.stdout + invalid.stderr).toBe(1);
    expect(invalid.report.checks).toMatchObject([
        { check: 'format/prettier', status: 'failed', findings: [{ file: 'source.js' }] },
    ]);
    const fixed = await consumerSandbox.run(consumerSandbox.root, [...formatter, '--fix']);
    expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
    const valid = await consumerSandbox.run(consumerSandbox.root, formatter);
    expect(valid.code, valid.stdout + valid.stderr).toBe(0);
    expect(await readFile(join(consumerSandbox.root, 'package.json'), 'utf8')).toBe(authoredPackage);
});
