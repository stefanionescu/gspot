// Delivered commands preserve authored instructions, report findings, and terminate canceled tools.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { readFile, writeFile } from 'node:fs/promises';
import type { InitJson } from '#cli/types/commands/init.ts';
import { createConsumer } from '#tests/harness/consumer.ts';
import { pathExists } from '#tests/harness/preservation.ts';
import { isPosix } from '#tests/config/harness/platforms.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { containingAll } from '#tests/harness/expectations.ts';
import { runTestCommand, prepareTestCommand } from '#tests/harness/command.ts';
import { waitForExit, waitForFile, captureChild } from '#tests/harness/process.ts';
import { initializeConsumer, getPublishedRelease } from '#tests/harness/release.ts';
import { LAUNCHER_FILES, SYNTAX_FINDINGS } from '#tests/config/packages/launcher.ts';

const release = getPublishedRelease();

// Assert the delivered takeover contract before inspecting the check report.
async function expectTakeover(root: string, output: string): Promise<void> {
    expect((JSON.parse(output) as InitJson).plan?.remove.map(({ path }) => path)).toStrictEqual([
        'prettier.config.mjs',
        '.editorconfig',
        'CLAUDE.md',
    ]);
    expect({
        policy: await pathExists(join(root, 'gspot.toml')),
        formatter: await pathExists(join(root, 'prettier.config.mjs')),
        instructions: await pathExists(join(root, 'CLAUDE.md')),
    }).toStrictEqual({ policy: true, formatter: false, instructions: false });
    const agents = await readFile(join(root, 'AGENTS.md'), 'utf8');
    expect({
        teamNotes: agents.startsWith('# Team notes\n'),
        ruleLink: agents.includes('WORKING.md'),
        otherInstructions: agents.endsWith('## Other instructions\n\n# Claude notes\n\nRun the tests.\n'),
    }).toStrictEqual({ teamNotes: true, ruleLink: true, otherInstructions: true });
}

test.skipIf(!isPosix)('launcher SIGTERM cancellation terminates its ready owned process', async () => {
    await using consumer = await createConsumer(release.registry, release.version);
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
        buildPolicy([], {
            tables: `[check."project/slow"]\nstage = "commit"\npaths = ["source.txt"]\ncommand = ${JSON.stringify(tool)}\n`,
        }),
    );
    const command = [...consumer.command, 'check', '--only', 'project/slow', '--json'];
    const prepared = prepareTestCommand(
        command,
        {
            cwd: cancellation,
            env: consumer.offlineOptions.env,
        },
        'launcher cancellation',
    );
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
        expect(await child.exited, `${prepared.context}\n${await capture.errors}`).toBe(2);
        const canceled = JSON.parse(await capture.output) as RunReport;
        expect(canceled.checks).toMatchObject([{ check: 'project/slow', status: 'error' }]);
        expect(canceled.checks[0]!.note).toContain('canceled');
    } finally {
        await waitForExit(toolPid);
    }
});

test('init replaces formatter files, moves authored instructions, and check reports findings', async () => {
    await using consumer = await createConsumer(release.registry, release.version);
    const { root } = consumer;
    await createFileTree(root, LAUNCHER_FILES);
    const initialized = await initializeConsumer(release, consumer);
    await expectTakeover(root, initialized.stdout);
    expect(initialized.stdout).not.toContain('formatter stdout');
    const checked = await runTestCommand(
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
        expect(finding.message).toContain(new URL('/', release.registry.url).href);
    }
    expect(
        checks.flatMap(({ check, status, findings }) =>
            findings.map(({ file, line }) => ({ check, status, file, line })),
        ),
    ).toEqual(containingAll([{ check: 'format/prettier', status: 'failed', file: 'source.js', line: undefined }]));
    expect(checks.find(({ check }) => check === 'bash/bash-syntax')).toMatchObject({
        status: 'failed',
        fileCount: 1,
        findings: SYNTAX_FINDINGS,
    });
    await writeFile(join(root, 'broken.sh'), 'echo example\n');
    const corrected = await runTestCommand(
        [...consumer.command, 'check', '--only', 'bash/bash-syntax', '--json'],
        consumer.offlineOptions,
    );
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    const clean = JSON.parse(corrected.stdout) as RunReport;
    expect(clean.exitCode).toBe(0);
    expect(clean.skips).toStrictEqual([]);
    expect(clean.checks).toHaveLength(1);
    expect(clean.checks[0]).toMatchObject({ check: 'bash/bash-syntax', status: 'passed', fileCount: 1, findings: [] });
    expect(await readFile(join(root, 'authored.txt'), 'utf8')).toBe(LAUNCHER_FILES['authored.txt']);
});
