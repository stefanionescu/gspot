// Delivered commands preserve authored instructions, report test defects, and terminate canceled tools.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import type { InitJson } from '#cli/types/commands/init.ts';
import { createConsumer } from '#tests/harness/consumer.ts';
import { isPosix } from '#tests/config/harness/platforms.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { containingAll } from '#tests/harness/expectations.ts';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { NATIVE_TEST_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import { runTestCommand, prepareTestCommand } from '#tests/harness/command.ts';
import { waitForExit, waitForFile, captureChild } from '#tests/harness/process.ts';
import { initializeConsumer, getPublishedRelease } from '#tests/harness/release.ts';
import { LAUNCHER_FILES, SYNTAX_FINDINGS } from '#tests/config/packages/launcher.ts';

const release = getPublishedRelease();

// Assert the delivered takeover contract before inspecting the check report.
function expectTakeover(root: string, output: string): void {
    expect((JSON.parse(output) as InitJson).plan?.remove.map(({ path }) => path)).toStrictEqual([
        'prettier.config.mjs',
        '.editorconfig',
        'CLAUDE.md',
    ]);
    expect({
        policy: existsSync(join(root, 'gspot.toml')),
        formatter: existsSync(join(root, 'prettier.config.mjs')),
        instructions: existsSync(join(root, 'CLAUDE.md')),
    }).toStrictEqual({ policy: true, formatter: false, instructions: false });
    const agents = readFileSync(join(root, 'AGENTS.md'), 'utf8');
    expect({
        teamNotes: agents.startsWith('# Team notes\n'),
        ruleLink: agents.includes('WORKING.md'),
        otherInstructions: agents.endsWith('## Other instructions\n\n# Claude notes\n\nRun the tests.\n'),
    }).toStrictEqual({ teamNotes: true, ruleLink: true, otherInstructions: true });
}

test.skipIf(!isPosix)(
    'launcher SIGTERM cancellation terminates its ready owned process',
    async () => {
        await using fixture = await createConsumer(release.registry, release.version);
        const cancellation = join(fixture.workspace, 'cancellation');
        await createFileTree(cancellation, { 'source.txt': 'input\n' });
        const marker = 'started.pid';
        const tool = [
            'node',
            '-e',
            `const fs = require('node:fs'); fs.writeFileSync(${JSON.stringify(marker + '.tmp')}, String(process.pid)); fs.renameSync(${JSON.stringify(marker + '.tmp')}, ${JSON.stringify(marker)}); setTimeout(() => {}, 60000);`,
        ];
        writeFileSync(
            join(cancellation, 'gspot.toml'),
            buildPolicy([], {
                tables: `[[check]]\nname = "project/slow"\nstage = "commit"\npaths = ["source.txt"]\ncommand = ${JSON.stringify(tool)}\n`,
            }),
        );
        const command = [...fixture.command, 'check', '--only', 'project/slow', '--json'];
        const prepared = prepareTestCommand(
            command,
            {
                cwd: cancellation,
                env: fixture.offlineOptions.env,
                timeoutMs: 30_000,
            },
            'launcher cancellation',
        );
        const child = Bun.spawn(command, {
            cwd: prepared.options.cwd,
            env: fixture.offlineOptions.env,
            stdout: 'pipe',
            stderr: 'pipe',
            timeout: prepared.options.timeoutMs,
            killSignal: 'SIGKILL',
        });
        await using capture = captureChild(child);
        expect(await waitForFile(join(cancellation, marker))).toBe(true);
        const toolPid = Number(readFileSync(join(cancellation, marker), 'utf8'));
        try {
            child.kill('SIGTERM');
            expect(await child.exited, `${prepared.context}\n${await capture.errors}`).toBe(2);
            const canceled = JSON.parse(await capture.output) as RunReport;
            expect(canceled.checks).toMatchObject([{ check: 'project/slow', status: 'error' }]);
            expect(canceled.checks[0]!.note).toContain('canceled');
        } finally {
            await waitForExit(toolPid);
        }
    },
    NATIVE_TEST_TIMEOUT_MS,
);

test(
    'init replaces formatter files, moves authored instructions, and check reports the test defects',
    async () => {
        await using fixture = await createConsumer(release.registry, release.version);
        const { root } = fixture;
        await createFileTree(root, LAUNCHER_FILES);
        const initialized = await initializeConsumer(release, fixture);
        expectTakeover(root, initialized.stdout);
        expect(initialized.stdout).not.toContain('formatter stdout');
        const checked = await runTestCommand(
            [
                ...fixture.command,
                'check',
                '--only',
                'bash/syntax',
                'dependencies/lockfile-hosts',
                'format/prettier',
                '--json',
            ],
            fixture.offlineOptions,
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
        expect(checks.find(({ check }) => check === 'bash/syntax')).toMatchObject({
            status: 'failed',
            fileCount: 1,
            findings: SYNTAX_FINDINGS,
        });
        writeFileSync(join(root, 'broken.sh'), 'echo example\n');
        const corrected = await runTestCommand(
            [...fixture.command, 'check', '--only', 'bash/syntax', '--json'],
            fixture.offlineOptions,
        );
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        const clean = JSON.parse(corrected.stdout) as RunReport;
        expect(clean.exitCode).toBe(0);
        expect(clean.skips).toStrictEqual([]);
        expect(clean.checks).toHaveLength(1);
        expect(clean.checks[0]).toMatchObject({ check: 'bash/syntax', status: 'passed', fileCount: 1, findings: [] });
        expect(readFileSync(join(root, 'authored.txt'), 'utf8')).toBe(LAUNCHER_FILES['authored.txt']);
    },
    NATIVE_TEST_TIMEOUT_MS,
);
