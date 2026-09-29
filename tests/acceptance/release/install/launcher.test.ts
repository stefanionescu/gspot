// Installs built packages from an isolated registry: the launcher stops its owned process on a signal and uninstall restores replaced files.
import prettier from 'prettier';
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { run } from '#cli/platform/spawn.ts';
import { reportSchema } from '#cli/execution/report.ts';
import { keptMode } from '#tests/support/cli/platforms.ts';
import { waitForExit } from '#tests/support/cli/process.ts';
import { policyOf } from '#tests/support/cli/policy/text.ts';
import { RELEASE_TIMEOUT_MS } from '#tests/inputs/release.ts';
import { createConsumer } from '#tests/support/release/consumer.ts';
import { lstatSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { initializeConsumer, getPublishedRelease } from '#tests/support/release/published.ts';

const release = getPublishedRelease();

// Kills a process that may already have exited; every other failure to kill it is reported.
function killIfRunning(pid: number): void {
    try {
        process.kill(pid, 'SIGKILL');
    } catch (error) {
        if (!(error instanceof Error) || !('code' in error) || error.code !== 'ESRCH') throw error;
    }
}

test.each(['SIGINT', 'SIGTERM'] as const)(
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
        const child = Bun.spawn([...fixture.command, 'check', '--json', '--no-cache'], {
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
            const canceled = reportSchema.parse(JSON.parse(await output));
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
    'init replaces the formatter files and uninstall restores their bytes and modes',
    async () => {
        await using fixture = await createConsumer(release.registry, release.version);
        expect(fixture.installed.code, fixture.installed.stdout + fixture.installed.stderr).toBe(0);
        const { consumer, command, options, editorconfig, formatter } = fixture;
        const { initialized, installedTools } = await initializeConsumer(release, fixture);
        expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
        expect(installedTools.code, installedTools.stdout + installedTools.stderr).toBe(0);
        expect(existsSync(join(consumer, 'gspot.toml'))).toBe(true);
        expect(existsSync(join(consumer, 'prettier.config.mjs'))).toBe(false);
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
        expect(existsSync(join(consumer, '.gspot', 'reports', 'report.json'))).toBe(false);
        const removed = await run([...command, 'uninstall', '--yes'], options);
        expect(removed.code, removed.stdout + removed.stderr).toBe(0);
        expect(readFileSync(join(consumer, '.editorconfig'), 'utf8')).toBe(editorconfig);
        expect(lstatSync(join(consumer, '.editorconfig')).mode & 0o777).toBe(keptMode(0o640));
        expect(readFileSync(join(consumer, 'prettier.config.mjs'), 'utf8')).toBe(formatter);
    },
    RELEASE_TIMEOUT_MS,
);
