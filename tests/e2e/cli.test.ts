import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { pathExists } from '#tests/setup/files.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { settingsText } from '#tests/setup/settings.ts';
import { containingAll } from '#tests/setup/matchers.ts';
import type { InitJson } from '#cli/types/commands/init.ts';
import { isWindows } from '#tests/setup/operating-systems.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { environmentVariables } from '#cli/system/environment.ts';
import { STARTING_FILES, BASH_SYNTAX_FINDINGS } from '#tests/config/e2e.ts';
import { setUpPackedSandbox, createPackedSandbox } from '#tests/setup/e2e-sandbox.ts';
import { runCommand, waitForExit, waitForFile, captureChild, prepareCommand } from '#tests/setup/processes.ts';

// Assert the delivered takeover contract before inspecting the check report.
async function expectReplacedFiles(root: string, output: string): Promise<void> {
    expect((JSON.parse(output) as InitJson).plan?.delete.map(({ path }) => path)).toStrictEqual([
        'prettier.config.mjs',
        '.editorconfig',
    ]);
    expect({
        settings: await pathExists(join(root, 'gspot.toml')),
        formatter: await pathExists(join(root, 'prettier.config.mjs')),
        instructions: await pathExists(join(root, 'CLAUDE.md')),
    }).toStrictEqual({ settings: true, formatter: false, instructions: true });
    expect(await readFile(join(root, 'CLAUDE.md'), 'utf8')).toBe(STARTING_FILES['CLAUDE.md']);
    const agents = await readFile(join(root, 'AGENTS.md'), 'utf8');
    expect({
        teamNotes: agents.startsWith('# Team notes\n'),
        ruleLink: agents.includes('WORKING.md'),
    }).toStrictEqual({ teamNotes: true, ruleLink: true });
}

// Windows does not deliver POSIX SIGTERM to the child process group.
test.skipIf(isWindows)('SIGTERM to the packed gspot stops the tool process it started', async () => {
    await using consumer = await createPackedSandbox(environmentVariables()['GSPOT_TEST_NPMRC']!);
    const cancellation = join(consumer.workspace, 'cancellation');
    await createFileTree(cancellation, { 'source.txt': 'input\n' });
    const marker = 'started.pid';
    const tool = [
        'node',
        '-e',
        `const fs = require('node:fs'); fs.writeFileSync(${JSON.stringify(marker + '.tmp')}, String(process.pid)); fs.renameSync(${JSON.stringify(marker + '.tmp')}, ${JSON.stringify(marker)}); setTimeout(() => {}, 60000);`,
    ];
    await writeFile(
        join(cancellation, 'gspot.toml'),
        settingsText([], {
            tables: `[[command_check]]\nname = "project/slow"\nstage = "commit"\npaths = ["source.txt"]\ncommand = ${JSON.stringify(tool)}\n`,
        }),
    );
    const command = [...consumer.command, 'check', '--only', 'project/slow', '--json'];
    const prepared = prepareCommand(command, {
        cwd: cancellation,
        env: consumer.offlineOptions.env,
    });
    const child = Bun.spawn(command, {
        cwd: prepared.options.cwd,
        env: consumer.offlineOptions.env,
        stdout: 'pipe',
        stderr: 'pipe',
        timeout: prepared.options.timeoutMs,
        killSignal: 'SIGKILL',
    });
    await using capture = captureChild(child);
    expect(await waitForFile(join(cancellation, marker))).toBe(true);
    const toolPid = Number(await readFile(join(cancellation, marker), 'utf8'));
    try {
        child.kill('SIGTERM');
        expect(await child.exited, `${prepared.context}\n${await capture.errors}`).toBe(143);
        const canceled = JSON.parse(await capture.output) as RunReport;
        expect(canceled.exitCode).toBe(143);
        expect(canceled.checks).toMatchObject([{ check: 'project/slow', status: 'error' }]);
        expect(canceled.checks[0]!.note).toContain('canceled');
    } finally {
        await waitForExit(toolPid);
    }
});

test('init replaces formatter files, leaves CLAUDE.md and your AGENTS.md notes as written, and check reports findings', async () => {
    await using consumer = await createPackedSandbox(environmentVariables()['GSPOT_TEST_NPMRC']!);
    const { root } = consumer;
    await createFileTree(root, STARTING_FILES);
    const initialized = await setUpPackedSandbox(consumer, {
        cwd: consumer.root,
        configurations: ['bash', 'python', 'swift'],
    });
    await expectReplacedFiles(root, initialized.stdout);
    expect(initialized.stdout).not.toContain('formatter stdout');
    const checked = await runCommand(
        [
            ...consumer.command,
            'check',
            '--only',
            'bash/bash-syntax',
            'dependencies/lockfile-hosts',
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
    const lockfileHosts = checks.find(({ check }) => check === 'dependencies/lockfile-hosts')!.findings;
    expect(lockfileHosts.length).toBeGreaterThan(0);
    for (const finding of lockfileHosts) {
        expect(finding).toMatchObject({ file: 'package-lock.json', rule: 'host' });
        expect(finding.message).toContain(new URL('/', environmentVariables()['GSPOT_TEST_NPM_REGISTRY']).href);
    }
    expect(
        checks.flatMap(({ check, status, findings }) =>
            findings.map(({ file, line }) => ({ check, status, file, line })),
        ),
    ).toEqual(containingAll([{ check: 'format/prettier', status: 'failed', file: 'source.js', line: undefined }]));
    expect(checks.find(({ check }) => check === 'bash/bash-syntax')).toMatchObject({
        status: 'failed',
        fileCount: 1,
        findings: BASH_SYNTAX_FINDINGS,
    });
    await writeFile(join(root, 'broken.sh'), 'echo example\n');
    const corrected = await runCommand(
        [...consumer.command, 'check', '--only', 'bash/bash-syntax', '--json'],
        consumer.offlineOptions,
    );
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    const clean = JSON.parse(corrected.stdout) as RunReport;
    expect(clean.exitCode).toBe(0);
    expect(clean.skips).toStrictEqual([]);
    expect(clean.checks).toHaveLength(1);
    expect(clean.checks[0]).toMatchObject({ check: 'bash/bash-syntax', status: 'passed', fileCount: 1, findings: [] });
    expect(await readFile(join(root, 'authored.txt'), 'utf8')).toBe(STARTING_FILES['authored.txt']);
});
