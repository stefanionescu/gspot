// Installs built packages from an isolated registry: the launcher stops its owned process on a signal and uninstall restores adopted files.
import { join } from 'node:path';
import { reportSchema } from '#cli/execution/report.ts';
import { waitForExit } from '#tests/support/cli/process.ts';
import { afterAll, expect, test } from 'bun:test';
import { runProcess as run } from '#tests/support/cli/command.ts';
import { RELEASE_TIMEOUT_MS } from '#tests/support/release/packages.ts';
import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { installedConsumer, initializeConsumer, publishRelease } from '#tests/support/release/published.ts';

// The release publishes once for this file, and its registry stops when the file's tests end.
const release = await publishRelease();
afterAll(async () => {
    await release.registry.stop();
});

// Kills a process that may already have exited; every other failure to kill it is reported.
function killIfRunning(pid: number): void {
    try {
        process.kill(pid, 'SIGKILL');
    } catch (error) {
        if (!(error instanceof Error) || !('code' in error) || error.code !== 'ESRCH') throw error;
    }
}

test(
    'launcher cancellation terminates its ready owned process',
    async () => {
        await using fixture = await installedConsumer(release);
        const { command, options } = fixture;
        const cancellation = join(fixture.workspace, 'cancellation');
        mkdirSync(cancellation);
        writeFileSync(join(cancellation, 'source.txt'), 'input\n');
        for (const signal of ['SIGINT', 'SIGTERM'] as const) {
            const marker = `${signal}.pid`;
            const tool = [
                'node',
                '-e',
                `require('node:fs').writeFileSync(${JSON.stringify(marker)}, String(process.pid)); setTimeout(() => {}, 60000);`,
            ];
            writeFileSync(
                join(cancellation, 'gspot.toml'),
                `version = 1\nconfigurations = []\n[[check]]\nname = "project/slow"\nstage = "commit"\npaths = ["source.txt"]\ncommand = ${JSON.stringify(tool)}\n`,
            );
            const child = Bun.spawn([...command, 'check', '--json', '--no-cache'], {
                cwd: cancellation,
                env: options.env,
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
                const canceled = reportSchema.parse(JSON.parse(await output));
                expect(canceled.checks[0]?.status).toBe('error');
                expect(canceled.checks[0]?.note).toContain('canceled');
                await waitForExit(toolPid);
            } finally {
                if (child.exitCode === null) child.kill('SIGKILL');
                if (toolPid !== undefined) killIfRunning(toolPid);
                await child.exited;
                await output;
                await errors;
            }
        }
    },
    RELEASE_TIMEOUT_MS,
);

test(
    'installed adoption restores original formatter bytes and EditorConfig modes',
    async () => {
        await using fixture = await installedConsumer(release);
        const { consumer, command, options, editorconfig, formatter } = fixture;
        await initializeConsumer(release, fixture);
        const removed = await run([...command, 'uninstall', '--yes'], options);
        expect(removed.code, removed.stdout + removed.stderr).toBe(0);
        expect(readFileSync(join(consumer, '.editorconfig'), 'utf8')).toBe(editorconfig);
        expect(lstatSync(join(consumer, '.editorconfig')).mode & 0o777).toBe(0o640);
        expect(readFileSync(join(consumer, 'prettier.config.mjs'), 'utf8')).toBe(formatter);
    },
    RELEASE_TIMEOUT_MS,
);
