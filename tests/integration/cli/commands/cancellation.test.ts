import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { join, dirname, delimiter } from 'node:path';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { git, gitOutput } from '#tests/harness/cli/git.ts';
import { spawnGspot } from '#tests/harness/cli/command.ts';
import type { PushReport } from '#cli/types/commands/check.ts';
import type { RunReport } from '#cli/types/execution/execution.ts';
import { environmentVariables } from '#cli/platform/environment.ts';
import { mkdirSync, existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { waitForExit, waitForFile, waitForJson, captureChild } from '#tests/harness/cli/process.ts';

const CLI = join(import.meta.dir, '../../../../packages/cli/src/main.ts');
const CHILD_OPTIONS = { stdout: 'pipe', stderr: 'pipe', timeout: 12_000, killSignal: 'SIGKILL' } as const;

// Every case signals a running gspot, and Windows ends a process without delivering a signal to its handlers.
const isWindows = process.platform === 'win32';

test.skipIf(isWindows).each(['SIGINT', 'SIGTERM'] as const)(
    'check propagates %s to an active tool and reports cancellation',
    async (signal) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': policyOf(
                [],
                `[[check]]\nname = "project/slow"\nstage = "commit"\npaths = ["source.txt"]\ncommand = ${JSON.stringify([process.execPath, '-e', 'await Bun.write("started.pid", String(process.pid)); await Bun.sleep(60_000);'])}\n`,
            ),
            'source.txt': 'input\n',
        });
        const child = Bun.spawn([process.execPath, CLI, 'check', '--json'], {
            cwd: sandbox.path,
            ...CHILD_OPTIONS,
        });
        await using capture = captureChild(child);
        const { output, errors } = capture;
        const started = join(sandbox.path, 'started.pid');
        expect(await waitForFile(started)).toBe(true);
        const toolPid = Number(readFileSync(started, 'utf8'));
        child.kill(signal);
        expect(await child.exited, await errors).toBe(2);
        const report = JSON.parse(await output) as RunReport;
        expect(report.checks).toHaveLength(1);
        expect(report.checks[0]!.status).toBe('error');
        expect(report.checks[0]!.note).toContain('canceled');
        await waitForExit(toolPid);
    },
    15_000,
);

test.skipIf(isWindows).each(['diff', 'clone', 'cat-file'])(
    'staged cancellation during %s preserves source content and permits retry',
    async (operation) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': policyOf(['bash'], '[guides]\ninstall = false\n'),
            'source.sh': 'echo indexed\n',
        });
        expect(git(sandbox.path, ['init', '-q']).code).toBe(0);
        expect(git(sandbox.path, ['add', '-A']).code).toBe(0);
        const indexed = git(sandbox.path, ['ls-files', '--stage', '-z']).stdout;
        writeFileSync(join(sandbox.path, 'source.sh'), 'echo authored\n');
        const nativeGit = Bun.which('git');
        expect(nativeGit).not.toBeNull();
        const marker = join(sandbox.path, 'started.json');
        const binaryDirectory = join(sandbox.path, 'bin');
        mkdirSync(binaryDirectory);
        writeFileSync(
            join(binaryDirectory, 'git'),
            `#!${process.execPath}\nconst args = process.argv.slice(2);\nif (args[0] === ${JSON.stringify(operation)}) {\nawait Bun.write(${JSON.stringify(marker)}, JSON.stringify({pid:process.pid,snapshot:args[0] === 'clone' ? args.at(-1) : args[0] === 'cat-file' ? process.cwd() : undefined}));\nawait Bun.sleep(60_000);\n} else {\nconst child=Bun.spawn([${JSON.stringify(nativeGit)}, ...args], {stdin:'inherit',stdout:'inherit',stderr:'inherit'});\nprocess.exit(await child.exited);\n}\n`,
            { mode: 0o755 },
        );
        const child = Bun.spawn([process.execPath, CLI, 'check', '--staged', '--only', 'bash/syntax', '--json'], {
            cwd: sandbox.path,
            env: {
                ...environmentVariables(),
                PATH: `${binaryDirectory}${delimiter}${environmentVariables()['PATH'] ?? ''}`,
            },
            ...CHILD_OPTIONS,
        });
        await using capture = captureChild(child);
        const { output, errors } = capture;
        const started = (await waitForJson(marker)) as { pid: number; snapshot?: string };
        child.kill(operation === 'clone' ? 'SIGINT' : 'SIGTERM');
        expect(await child.exited, await errors).toBe(2);
        expect(JSON.parse(await output)).toStrictEqual({ error: 'canceled', exitCode: 2 });
        await waitForExit(started.pid);
        // A snapshot the run had started is gone with it.
        expect(started.snapshot !== undefined && existsSync(started.snapshot)).toBe(false);
        expect(git(sandbox.path, ['ls-files', '--stage', '-z']).stdout).toBe(indexed);
        expect(readFileSync(join(sandbox.path, 'source.sh'), 'utf8')).toBe('echo authored\n');
        const retry = await spawnGspot(sandbox.path, ['check', '--staged', '--only', 'bash/syntax', '--json']);
        expect(retry.code, retry.stdout + retry.stderr).toBe(0);
        expect((JSON.parse(retry.stdout) as RunReport).checks[0]!.status).toBe('ok');
    },
    20_000,
);

test.skipIf(isWindows)(
    'push cancellation retains completed reports and names references not checked',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': policyOf(['bash'], '[guides]\ninstall = false\n'),
            'source.sh': 'echo first\n',
        });
        for (const args of [
            ['init', '-q'],
            ['add', '-A'],
            ['commit', '-qm', 'feat: first'],
        ])
            gitOutput(sandbox.path, args);
        const first = git(sandbox.path, ['rev-parse', 'HEAD']).stdout.trim();
        writeFileSync(join(sandbox.path, 'source.sh'), 'echo second\n');
        expect(git(sandbox.path, ['commit', '-qam', 'feat: second']).code).toBe(0);
        const second = git(sandbox.path, ['rev-parse', 'HEAD']).stdout.trim();
        const marker = join(sandbox.path, 'started.json');
        const counter = join(sandbox.path, 'clones.txt');
        const nativeGit = Bun.which('git');
        expect(nativeGit).not.toBeNull();
        const binaryDirectory = join(sandbox.path, 'bin');
        mkdirSync(binaryDirectory);
        writeFileSync(
            join(binaryDirectory, 'git'),
            `#!${process.execPath}\nconst args=process.argv.slice(2);\nif(args[0]==='clone'){\nconst file=Bun.file(${JSON.stringify(counter)});\nconst count=await file.exists()?Number(await file.text()):0;\nawait Bun.write(file,String(count+1));\nif(count===1){await Bun.write(${JSON.stringify(marker)},JSON.stringify({pid:process.pid,snapshot:args.at(-1)}));await Bun.sleep(60_000);}\n}\nconst child=Bun.spawn([${JSON.stringify(nativeGit)},...args],{stdin:'inherit',stdout:'inherit',stderr:'inherit'});\nprocess.exit(await child.exited);\n`,
            { mode: 0o755 },
        );
        const protocol = `refs/heads/first ${first} refs/heads/first ${'0'.repeat(40)}\nrefs/heads/second ${second} refs/heads/second ${'0'.repeat(40)}\n`;
        const child = Bun.spawn([process.execPath, CLI, 'check', '--push', '--only', 'bash/syntax', '--json'], {
            cwd: sandbox.path,
            env: {
                ...environmentVariables(),
                PATH: `${binaryDirectory}${delimiter}${environmentVariables()['PATH'] ?? ''}`,
            },
            stdin: Buffer.from(protocol),
            ...CHILD_OPTIONS,
        });
        await using capture = captureChild(child);
        const { output, errors } = capture;
        const started = (await waitForJson(marker)) as { pid: number; snapshot: string };
        child.kill('SIGINT');
        expect(await child.exited, await errors).toBe(2);
        const report = JSON.parse(await output) as PushReport;
        expect(report).toMatchObject({
            revisions: [{ object: first, report: { checks: [{ status: 'ok' }] } }],
            canceled: { pendingRefs: ['refs/heads/second'] },
            exitCode: 2,
        });
        expect(existsSync(started.snapshot)).toBe(false);
        await waitForExit(started.pid);
        expect(git(sandbox.path, ['rev-parse', 'HEAD']).stdout.trim()).toBe(second);
    },
    20_000,
);

test.skipIf(isWindows).each(['SIGINT', 'SIGTERM'] as const)(
    'push cancellation while stdin remains open handles %s and permits retry',
    async (signal) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': policyOf(['bash'], '[guides]\ninstall = false\n'),
            'source.sh': 'echo indexed\n',
        });
        expect(git(sandbox.path, ['init', '-q']).code).toBe(0);
        expect(git(sandbox.path, ['add', '-A']).code).toBe(0);
        const indexed = git(sandbox.path, ['ls-files', '--stage', '-z']).stdout;
        const started = join(sandbox.path, 'listening');
        const program = `
process.on('newListener',(name)=>{ if(name==='SIGTERM') setImmediate(()=>require('node:fs').writeFileSync(${JSON.stringify(started)},'ready')); });
process.argv=[process.execPath,${JSON.stringify(CLI)},'check','--push','--json'];
await import(${JSON.stringify(CLI)});
`;
        const child = Bun.spawn([process.execPath, '-e', program], {
            cwd: sandbox.path,
            stdin: 'pipe',
            ...CHILD_OPTIONS,
        });
        await using capture = captureChild(child);
        const { output, errors } = capture;
        try {
            await child.stdin.write('refs/heads/incomplete ');
            await child.stdin.flush();
            expect(await waitForFile(started)).toBe(true);
            child.kill(signal);
            expect(await child.exited, await errors).toBe(2);
            expect(JSON.parse(await output)).toStrictEqual({ error: 'canceled', exitCode: 2 });
            expect(git(sandbox.path, ['ls-files', '--stage', '-z']).stdout).toBe(indexed);
            const retry = await spawnGspot(sandbox.path, ['check', '--staged', '--only', 'bash/syntax', '--json']);
            expect(retry.code, retry.stdout + retry.stderr).toBe(0);
            expect((JSON.parse(retry.stdout) as RunReport).checks[0]!.status).toBe('ok');
        } finally {
            await child.stdin.end();
        }
    },
    15_000,
);

test.skipIf(isWindows)(
    'staged cancellation during dependency copying removes partial output and preserves the installed source',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': policyOf(['bash'], '[guides]\ninstall = false\n'),
            '.gitignore': 'node_modules/\n',
            'package.json': '{"name":"snapshot-consumer","private":true}\n',
            'package-lock.json': '{"name":"snapshot-consumer","lockfileVersion":3,"packages":{}}\n',
            'source.sh': 'echo indexed\n',
        });
        expect(git(sandbox.path, ['init', '-q']).code).toBe(0);
        expect(git(sandbox.path, ['add', '-A']).code).toBe(0);
        const indexed = git(sandbox.path, ['ls-files', '--stage', '-z']).stdout;
        const dependencies = join(sandbox.path, 'node_modules');
        mkdirSync(dependencies);
        for (let index = 0; index < 4000; index++)
            writeFileSync(join(dependencies, `${String(index)}.js`), `export const value=${String(index)};\n`);
        const marker = join(sandbox.path, 'copying.json');
        const program = `
import { mock } from 'bun:test';
const filesystem=await import('node:fs/promises');
const copy=filesystem.cp;
mock.module('node:fs/promises',()=>({...filesystem,async cp(source,destination,options){
await Bun.write(${JSON.stringify(marker)},JSON.stringify({destination}));
return copy(source,destination,options);
}}));
process.argv=[process.execPath,${JSON.stringify(CLI)},'check','--staged','--only','bash/syntax','--json'];
await import(${JSON.stringify(CLI)});
`;
        const child = Bun.spawn([process.execPath, '-e', program], {
            cwd: sandbox.path,
            ...CHILD_OPTIONS,
        });
        await using capture = captureChild(child);
        const { output, errors } = capture;
        const read = (await waitForJson(marker)) as { destination: string };
        child.kill('SIGTERM');
        expect(await child.exited, await errors).toBe(2);
        expect(JSON.parse(await output)).toStrictEqual({ error: 'canceled', exitCode: 2 });
        expect(existsSync(dirname(read.destination))).toBe(false);
        expect(git(sandbox.path, ['ls-files', '--stage', '-z']).stdout).toBe(indexed);
        expect(readdirSync(dependencies)).toHaveLength(4000);
        expect(readFileSync(join(dependencies, '0.js'), 'utf8')).toBe('export const value=0;\n');
        expect(readFileSync(join(dependencies, '3999.js'), 'utf8')).toBe('export const value=3999;\n');
        const retry = await spawnGspot(sandbox.path, ['check', '--staged', '--only', 'bash/syntax', '--json']);
        expect(retry.code, retry.stdout + retry.stderr).toBe(0);
        expect((JSON.parse(retry.stdout) as RunReport).checks[0]!.status).toBe('ok');
    },
    20_000,
);
