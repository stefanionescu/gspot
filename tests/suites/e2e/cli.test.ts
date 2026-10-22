import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { join, delimiter } from 'node:path';
import { CI_PINS } from '#cli/config/generation/ci.ts';
import { isOnDisk } from '#tests/setup/system/files.ts';
import type { InitJson } from '#cli/types/commands/init.ts';
import type { UserProject } from '#tests/types/packages.ts';
import { runCommand } from '#tests/setup/system/processes.ts';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { initSandbox } from '#tests/setup/sandboxes/create.ts';
import { parseCheckReport } from '#tests/setup/cli/commands.ts';
import { writeScriptCommand } from '#tests/setup/system/fakes.ts';
import { buildSpawnEnvironment } from '#cli/system/environment.ts';
import { createUserProject } from '#tests/setup/sandboxes/user-project.ts';
import { STARTING_FILES, SHELLCHECK_SYNTAX_FINDINGS } from '#tests/config/e2e/cli.ts';

/** Check which conflicting config files init replaced and kept, before the test reads the check report. */
async function assertConflictingConfigFiles(root: string, output: string): Promise<void> {
    const { plan } = JSON.parse(output) as InitJson;
    expect(plan.delete).toStrictEqual([]);
    expect(plan.write.filter(({ path }) => ['prettier.config.mjs', '.editorconfig'].includes(path))).toStrictEqual(
        ['.editorconfig', 'prettier.config.mjs'].map((path) => ({
            path,
            note: `replaces your file; read the old one with git show HEAD:${path}`,
        })),
    );
    const formatter = await readFile(join(root, 'prettier.config.mjs'), 'utf8');
    expect({
        settings: await isOnDisk(join(root, 'gspot.toml')),
        authoredFormatter: formatter.includes('formatter stdout'),
        instructions: await isOnDisk(join(root, 'CLAUDE.md')),
    }).toStrictEqual({ settings: true, authoredFormatter: false, instructions: true });
    expect(await readFile(join(root, 'CLAUDE.md'), 'utf8')).toBe(STARTING_FILES['CLAUDE.md']);
    const agents = await readFile(join(root, 'AGENTS.md'), 'utf8');
    expect({
        teamNotes: agents.startsWith('# Team notes\n'),
        ruleLink: agents.includes('WORKING.md'),
    }).toStrictEqual({ teamNotes: true, ruleLink: true });
}

test('init replaces formatter files, keeps your notes and CLAUDE.md, and check reports findings', async () => {
    await using sandbox = await createUserProject();
    const { root } = sandbox;
    await createFileTree(root, STARTING_FILES);
    const initialized = await initSandbox(sandbox.online, {
        configurations: ['bash', 'python', 'swift'],
    });
    await assertConflictingConfigFiles(root, initialized.stdout);
    expect(initialized.stdout).not.toContain('formatter stdout');
    const checked = parseCheckReport(
        await sandbox.offline.run(
            root,
            ['check', '--only', 'bash/shellcheck,dependencies/lockfiles,format/prettier', '--json'],
            sandbox.offline.environment,
        ),
    );
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    const { checks, exitCode } = checked.report;
    expect(exitCode).toBe(1);
    expect(checks).toHaveLength(3);
    expect(checks.filter(({ status }) => status === 'error' || status === 'missing')).toStrictEqual([]);
    // The throwaway registry serves HTTP archives, which the lockfile of the test project must report.
    const lockfileHosts = checks.find(({ check }) => check === 'dependencies/lockfiles')!.findings;
    expect(lockfileHosts.length).toBeGreaterThan(0);
    for (const finding of lockfileHosts) {
        expect(finding).toMatchObject({ file: 'package-lock.json', rule: 'host' });
        expect(finding.message).toContain(new URL('/', buildSpawnEnvironment()['GSPOT_TEST_NPM_REGISTRY']).href);
    }
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
        await sandbox.offline.run(root, ['check', '--only', 'bash/shellcheck', '--json'], sandbox.offline.environment),
    );
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    const clean = corrected.report;
    expect(clean.exitCode).toBe(0);
    expect(clean.checks).toHaveLength(1);
    expect(clean.checks[0]).toMatchObject({ check: 'bash/shellcheck', status: 'passed', fileCount: 1, findings: [] });
    expect(await readFile(join(root, 'authored.txt'), 'utf8')).toBe(STARTING_FILES['authored.txt']);
});

/**
 * Install the format configuration in a Bun project. The fake mise prints the pinned mise version and does nothing else,
 * so install skips the mise programs that format/prettier does not need.
 */
async function prepareFormatterSandbox(installation: UserProject) {
    const toolConsumer = join(installation.workspace, 'tool-consumer');
    const systemTools = join(installation.workspace, 'system-tools');
    await mkdir(toolConsumer);
    await writeScriptCommand(systemTools, 'mise', `console.log(${JSON.stringify(CI_PINS.mise.version)});\n`);
    const bun = await runCommand(['bun', '--version'], {
        cwd: toolConsumer,
        env: installation.online.environment,
    });
    if (bun.code !== 0) throw new Error(`Bun version failed: ${bun.stdout}${bun.stderr}`);
    const authoredPackage = JSON.stringify({
        private: true,
        packageManager: `bun@${bun.stdout.trim()}`,
        scripts: { test: 'authored-command' },
    });
    await writeFile(join(toolConsumer, 'package.json'), authoredPackage);
    await writeFile(join(toolConsumer, 'source.js'), 'export const greeting="hello";');
    const toolOptions = {
        ...installation.online,
        root: toolConsumer,
        environment: {
            ...installation.online.environment,
            PATH: `${systemTools}${delimiter}${installation.online.environment['PATH'] ?? ''}`,
        },
    };
    await initSandbox(toolOptions, {
        configurations: ['format'],
        level: 'all',
    });
    return { toolConsumer, toolOptions, authoredPackage };
}

test('the installed formatter reports and fixes source and keeps your package.json fields', async () => {
    await using consumer = await createUserProject();

    const { toolConsumer, toolOptions, authoredPackage } = await prepareFormatterSandbox(consumer);
    const formatter = ['check', 'source.js', '--only', 'format/prettier', '--json'];
    const invalid = parseCheckReport(await toolOptions.run(toolConsumer, formatter, toolOptions.environment));
    expect(invalid.code, invalid.stdout + invalid.stderr).toBe(1);
    expect(invalid.report.checks).toMatchObject([
        { check: 'format/prettier', status: 'failed', findings: [{ file: 'source.js' }] },
    ]);
    const fixed = await toolOptions.run(toolConsumer, [...formatter, '--fix'], toolOptions.environment);
    expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
    const valid = await toolOptions.run(toolConsumer, formatter, toolOptions.environment);
    expect(valid.code, valid.stdout + valid.stderr).toBe(0);
    expect(await readFile(join(toolConsumer, 'package.json'), 'utf8')).toBe(authoredPackage);
});
