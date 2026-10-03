// Installs built packages from an isolated registry: the launcher stops its owned process on a signal, and init replaces formatter files.
import prettier from 'prettier';
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { waitForExit } from '#tests/harness/cli/process.ts';
import { RELEASE_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { RunReport } from '#cli/types/execution/execution.ts';
import { createConsumer } from '#tests/harness/package/consumer.ts';
import { initializeConsumer, getPublishedRelease } from '#tests/harness/package/published.ts';

const release = getPublishedRelease();

// Kills a process that may already have exited; every other failure to kill it is reported.
function killIfRunning(pid: number): void {
    try {
        process.kill(pid, 'SIGKILL');
    } catch (error) {
        if (!(error instanceof Error) || !('code' in error) || error.code !== 'ESRCH') throw error;
    }
}

test.each(['SIGTERM'] as const)(
    'launcher cancellation with %s terminates its ready owned process',
    async (signal) => {
        await using fixture = await createConsumer(release.registry, release.version);
        expect(fixture.installed.code, fixture.installed.stdout + fixture.installed.stderr).toBe(0);
        const cancellation = join(fixture.workspace, 'cancellation');
        await createFileTree(cancellation, { 'source.txt': 'input\n' });
        const marker = `${signal}.pid`;
        const tool = [
            'node',
            '-e',
            `require('node:fs').writeFileSync(${JSON.stringify(marker)}, String(process.pid)); setTimeout(() => {}, 60000);`,
        ];
        writeFileSync(
            join(cancellation, 'gspot.toml'),
            policyOf(
                [],
                `[[check]]\nname = "project/slow"\nstage = "commit"\npaths = ["source.txt"]\ncommand = ${JSON.stringify(tool)}\n`,
            ),
        );
        const child = Bun.spawn([...fixture.command, 'check', '--json'], {
            cwd: cancellation,
            env: fixture.options.env,
            stdout: 'pipe',
            stderr: 'pipe',
        });
        const output = new Response(child.stdout).text();
        const errors = new Response(child.stderr).text();
        let toolPid: number | undefined;
        try {
            const deadline = performance.now() + 10_000;
            while (!existsSync(join(cancellation, marker)) && performance.now() < deadline) await Bun.sleep(20);
            expect(existsSync(join(cancellation, marker))).toBe(true);
            toolPid = Number(readFileSync(join(cancellation, marker), 'utf8'));
            child.kill(signal);
            const exitDeadline = performance.now() + 10_000;
            while (child.exitCode === null && performance.now() < exitDeadline) await Bun.sleep(20);
            expect(child.exitCode).not.toBeNull();
            expect(await child.exited, await errors).toBe(2);
            const canceled = JSON.parse(await output) as RunReport;
            expect(canceled.checks[0]!.status).toBe('error');
            expect(canceled.checks[0]!.note).toContain('canceled');
            await waitForExit(toolPid);
        } finally {
            if (child.exitCode === null) child.kill('SIGKILL');
            if (toolPid !== undefined) killIfRunning(toolPid);
            await child.exited;
            await output;
            await errors;
        }
    },
    RELEASE_TIMEOUT_MS,
);

test(
    'init replaces the formatter files and moves CLAUDE.md into AGENTS.md, and check runs',
    async () => {
        await using fixture = await createConsumer(release.registry, release.version);
        expect(fixture.installed.code, fixture.installed.stdout + fixture.installed.stderr).toBe(0);
        const { consumer } = fixture;
        writeFileSync(join(consumer, 'AGENTS.md'), '# Team notes\n');
        writeFileSync(join(consumer, 'CLAUDE.md'), '# Claude notes\n\nRun the tests.\n');
        const { initialized, installedTools } = await initializeConsumer(release, fixture);
        expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
        expect(installedTools.code, installedTools.stdout + installedTools.stderr).toBe(0);
        expect(existsSync(join(consumer, 'gspot.toml'))).toBe(true);
        expect(existsSync(join(consumer, 'prettier.config.mjs'))).toBe(false);
        expect(existsSync(join(consumer, 'CLAUDE.md'))).toBe(false);
        const agents = readFileSync(join(consumer, 'AGENTS.md'), 'utf8');
        expect(agents).toStartWith('# Team notes\n');
        expect(agents).toContain('WORKING.md');
        expect(agents).toEndWith('## Other instructions\n\n# Claude notes\n\nRun the tests.\n');
        expect(() => {
            JSON.parse(initialized.stdout);
        }).not.toThrow();
        expect(initialized.stdout).not.toContain('formatter stdout');
        const filepath = join(consumer, 'source.js');
        const formatting = await prettier.resolveConfig(filepath, {
            config: join(consumer, '.gspot/config/prettier.json'),
            editorconfig: true,
            useCache: false,
        });
        expect(await prettier.format(readFileSync(filepath, 'utf8'), { ...formatting, filepath })).toBe(
            "const greeting = 'hello';\n",
        );
        const futureJson = await prettier.resolveConfig(join(consumer, 'nested/future.json'), {
            config: join(consumer, '.gspot/config/prettier.json'),
            editorconfig: true,
            useCache: false,
        });
        expect(futureJson?.tabWidth).toBe(4);
        const checked = Bun.spawnSync([...fixture.command, 'check', '--json'], {
            cwd: consumer,
            env: fixture.options.env,
            timeout: RELEASE_TIMEOUT_MS,
        });
        // The fixture holds a broken script and selects kits whose tools find nothing to run on, so the run reports
        // findings and errored checks. A crash prints an error object with no checks.
        expect([0, 1, 2], checked.stderr.toString()).toContain(checked.exitCode);
        expect((JSON.parse(checked.stdout.toString()) as RunReport).checks.length).toBeGreaterThan(0);
    },
    RELEASE_TIMEOUT_MS,
);
