import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { join, delimiter } from 'node:path';
import { fakeTool } from '#tests/setup/fakes.ts';
import { isOnDisk } from '#tests/setup/files.ts';
import { matchItems } from '#tests/setup/matchers.ts';
import { CI_PINS } from '#cli/config/generation/ci.ts';
import { runCommand } from '#tests/setup/processes.ts';
import type { InitJson } from '#cli/types/commands/init.ts';
import type { PackedSandbox } from '#tests/types/packages.ts';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import type { RunReport } from '#cli/types/checks/run/check.ts';
import { buildSpawnEnvironment } from '#cli/system/environment.ts';
import { setUpPackedSandbox, createPackedSandbox } from '#tests/setup/packed-sandbox.ts';
import { STARTING_FILES, SHELLCHECK_SYNTAX_FINDINGS } from '#tests/data/packed-install.ts';

// Checks what init replaced and kept, before the test reads the check report.
async function assertReplacedFiles(root: string, output: string): Promise<void> {
    expect((JSON.parse(output) as InitJson).plan?.delete.map(({ path }) => path)).toStrictEqual([
        'prettier.config.mjs',
        '.editorconfig',
    ]);
    expect({
        settings: await isOnDisk(join(root, 'gspot.toml')),
        formatter: await isOnDisk(join(root, 'prettier.config.mjs')),
        instructions: await isOnDisk(join(root, 'CLAUDE.md')),
    }).toStrictEqual({ settings: true, formatter: false, instructions: true });
    expect(await readFile(join(root, 'CLAUDE.md'), 'utf8')).toBe(STARTING_FILES['CLAUDE.md']);
    const agents = await readFile(join(root, 'AGENTS.md'), 'utf8');
    expect({
        teamNotes: agents.startsWith('# Team notes\n'),
        ruleLink: agents.includes('WORKING.md'),
    }).toStrictEqual({ teamNotes: true, ruleLink: true });
}

test('init replaces formatter files, keeps your notes and CLAUDE.md, and check reports findings', async () => {
    await using consumer = await createPackedSandbox();
    const { root } = consumer;
    await createFileTree(root, STARTING_FILES);
    const initialized = await setUpPackedSandbox(consumer, {
        cwd: consumer.root,
        configurations: ['bash', 'python', 'swift'],
    });
    await assertReplacedFiles(root, initialized.stdout);
    expect(initialized.stdout).not.toContain('formatter stdout');
    const checked = await runCommand(
        [
            ...consumer.command,
            'check',
            '--only',
            'bash/shellcheck',
            'dependencies/lockfiles',
            'format/prettier',
            '--json',
        ],
        consumer.offlineOptions,
    );
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    const { checks, exitCode } = JSON.parse(checked.stdout) as RunReport;
    expect(exitCode).toBe(1);
    expect(checks).toHaveLength(3);
    expect(checks.filter(({ status }) => status === 'error' || status === 'missing')).toStrictEqual([]);
    // The throwaway registry serves HTTP archives, which the consumer lockfile must report.
    const lockfileHosts = checks.find(({ check }) => check === 'dependencies/lockfiles')!.findings;
    expect(lockfileHosts.length).toBeGreaterThan(0);
    for (const finding of lockfileHosts) {
        expect(finding).toMatchObject({ file: 'package-lock.json', rule: 'host' });
        expect(finding.message).toContain(new URL('/', buildSpawnEnvironment()['GSPOT_TEST_NPM_REGISTRY']).href);
    }
    expect(
        checks.flatMap(({ check, status, findings }) =>
            findings.map(({ file, line }) => ({ check, status, file, line })),
        ),
    ).toEqual(matchItems([{ check: 'format/prettier', status: 'failed', file: 'source.js', line: undefined }]));
    expect(checks.find(({ check }) => check === 'bash/shellcheck')).toMatchObject({
        status: 'failed',
        fileCount: 1,
        findings: SHELLCHECK_SYNTAX_FINDINGS,
    });
    await writeFile(join(root, 'broken.sh'), 'echo example\n');
    const corrected = await runCommand(
        [...consumer.command, 'check', '--only', 'bash/shellcheck', '--json'],
        consumer.offlineOptions,
    );
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    const clean = JSON.parse(corrected.stdout) as RunReport;
    expect(clean.exitCode).toBe(0);
    expect(clean.skips).toStrictEqual([]);
    expect(clean.checks).toHaveLength(1);
    expect(clean.checks[0]).toMatchObject({ check: 'bash/shellcheck', status: 'passed', fileCount: 1, findings: [] });
    expect(await readFile(join(root, 'authored.txt'), 'utf8')).toBe(STARTING_FILES['authored.txt']);
});

/** Install the format configuration in a package project, with a fake mise first on the path. */
async function prepareFormatterSandbox(installation: PackedSandbox) {
    const toolConsumer = join(installation.workspace, 'tool-consumer');
    const systemTools = join(installation.workspace, 'system-tools');
    await mkdir(toolConsumer);
    await fakeTool(systemTools, 'mise', `console.log(${JSON.stringify(CI_PINS.mise.version)});\n`);
    const bun = await runCommand(['bun', '--version'], {
        cwd: toolConsumer,
        env: installation.onlineOptions.env,
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
        ...installation.onlineOptions,
        cwd: toolConsumer,
        env: {
            ...installation.onlineOptions.env,
            PATH: `${systemTools}${delimiter}${installation.onlineOptions.env['PATH'] ?? ''}`,
            NO_PROXY: '127.0.0.1,localhost',
        },
    };
    await setUpPackedSandbox(
        { ...installation, onlineOptions: toolOptions },
        {
            cwd: toolConsumer,
            configurations: ['format'],
            level: 'all',
        },
    );
    return { toolConsumer, toolOptions, authoredPackage };
}

test('the installed formatter reports and fixes source and keeps your package.json fields', async () => {
    await using consumer = await createPackedSandbox();

    const { command } = consumer;
    const { toolConsumer, toolOptions, authoredPackage } = await prepareFormatterSandbox(consumer);
    const formatter = [...command, 'check', 'source.js', '--only', 'format/prettier', '--json'];
    const invalid = await runCommand(formatter, toolOptions);
    expect(invalid.code, invalid.stdout + invalid.stderr).toBe(1);
    expect((JSON.parse(invalid.stdout) as RunReport).checks).toMatchObject([
        { check: 'format/prettier', status: 'failed', findings: [{ file: 'source.js' }] },
    ]);
    const fixed = await runCommand([...formatter, '--fix'], toolOptions);
    expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
    const valid = await runCommand(formatter, toolOptions);
    expect(valid.code, valid.stdout + valid.stderr).toBe(0);
    expect(await readFile(join(toolConsumer, 'package.json'), 'utf8')).toBe(authoredPackage);
});
