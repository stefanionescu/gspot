import { expect, test } from 'bun:test';
import { dirname, join } from 'node:path';
import { git } from '#tests/support/cli/git.ts';
import { createFileTree, testdir } from 'testdirs';
import { run } from '#tests/support/cli/command.ts';
import type { RunReport } from '#cli/output/schema.ts';
import { pushReportSchema } from '#cli/output/schema.ts';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';

const CLI = join(import.meta.dir, '../../../packages/cli/src/main.ts');

test.each(['SIGINT', 'SIGTERM'] as const)(
    'check propagates %s to an active tool and reports cancellation',
    async (signal) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': `version = 1\nconfigurations = []\n[[check]]\nname = "project/slow"\nstage = "commit"\npaths = ["source.txt"]\ncommand = ${JSON.stringify([process.execPath, '-e', 'await Bun.write("started.pid", String(process.pid)); await Bun.sleep(60_000);'])}\n`,
            'source.txt': 'input\n',
        });
        const child = Bun.spawn([process.execPath, CLI, 'check', '--json', '--no-cache'], {
            cwd: sandbox.path,
            stdout: 'pipe',
            stderr: 'pipe',
        });
        const output = new Response(child.stdout).text();
        const errors = new Response(child.stderr).text();
        try {
            const started = join(sandbox.path, 'started.pid');
            const deadline = performance.now() + 10_000;
            while (!existsSync(started) && performance.now() < deadline) await Bun.sleep(20);
            expect(existsSync(started)).toBe(true);
            const toolPid = Number(readFileSync(started, 'utf8'));
            child.kill(signal);
            expect(await child.exited, await errors).toBe(2);
            const report = JSON.parse(await output) as RunReport;
            expect(report.checks).toHaveLength(1);
            expect(report.checks[0]!.status).toBe('error');
            expect(report.checks[0]!.note).toContain('canceled');
            expect(report.coverage.checked).toBe(0);
            expect(
                JSON.parse(readFileSync(join(sandbox.path, '.gspot/reports/report.sarif'), 'utf8')).runs[0]
                    .invocations[0].executionSuccessful,
            ).toBe(false);
            expect(() => process.kill(toolPid, 0)).toThrow();
        } finally {
            if (child.exitCode === null) child.kill('SIGKILL');
            await child.exited;
            await output;
            await errors;
        }
    },
    15_000,
);

test.each(['diff', 'clone', 'cat-file'])(
    'staged cancellation during %s preserves source content and permits retry',
    async (operation) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': 'version = 1\nconfigurations = ["bash"]\n[rules]\ninstall = false\n',
            'source.sh': 'echo indexed\n',
        });
        expect(git(sandbox.path, ['init', '-q']).code).toBe(0);
        expect(git(sandbox.path, ['add', '-A']).code).toBe(0);
        const indexed = git(sandbox.path, ['ls-files', '--stage', '-z']).stdout;
        writeFileSync(join(sandbox.path, 'source.sh'), 'echo authored\n');
        const nativeGit = Bun.which('git');
        expect(nativeGit).not.toBeNull();
        const marker = join(sandbox.path, 'started.json');
        const shim = join(sandbox.path, 'bin');
        mkdirSync(shim);
        writeFileSync(
            join(shim, 'git'),
            `#!${process.execPath}\nconst args = process.argv.slice(2);\nif (args[0] === ${JSON.stringify(operation)}) {\nawait Bun.write(${JSON.stringify(marker)}, JSON.stringify({pid:process.pid,snapshot:args[0] === 'clone' ? args.at(-1) : args[0] === 'cat-file' ? process.cwd() : undefined}));\nawait Bun.sleep(60_000);\n} else {\nconst child=Bun.spawn([${JSON.stringify(nativeGit)}, ...args], {stdin:'inherit',stdout:'inherit',stderr:'inherit'});\nprocess.exit(await child.exited);\n}\n`,
            { mode: 0o755 },
        );
        const child = Bun.spawn([process.execPath, CLI, 'check', '--staged', '--only', 'bash/syntax', '--json'], {
            cwd: sandbox.path,
            env: { ...process.env, PATH: `${shim}:${process.env['PATH'] ?? ''}` },
            stdout: 'pipe',
            stderr: 'pipe',
        });
        const output = new Response(child.stdout).text();
        const errors = new Response(child.stderr).text();
        try {
            const deadline = performance.now() + 10_000;
            while (!existsSync(marker) && performance.now() < deadline) await Bun.sleep(20);
            expect(existsSync(marker)).toBe(true);
            const started = JSON.parse(readFileSync(marker, 'utf8')) as { pid: number; snapshot?: string };
            child.kill(operation === 'clone' ? 'SIGINT' : 'SIGTERM');
            expect(await child.exited, await errors).toBe(2);
            expect(JSON.parse(await output)).toStrictEqual({ error: 'canceled', exitCode: 2 });
            expect(() => process.kill(started.pid, 0)).toThrow();
            if (started.snapshot !== undefined) expect(existsSync(started.snapshot)).toBe(false);
            expect(git(sandbox.path, ['ls-files', '--stage', '-z']).stdout).toBe(indexed);
            expect(readFileSync(join(sandbox.path, 'source.sh'), 'utf8')).toBe('echo authored\n');
            const retry = await run(sandbox.path, ['check', '--staged', '--only', 'bash/syntax', '--json']);
            expect(retry.code, retry.stdout + retry.stderr).toBe(0);
            expect(JSON.parse(retry.stdout).checks[0].status).toBe('ok');
        } finally {
            if (child.exitCode === null) child.kill('SIGKILL');
            await child.exited;
            await output;
            await errors;
        }
    },
    20_000,
);

test('push cancellation retains completed reports and names references not checked', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nconfigurations = ["bash"]\n[rules]\ninstall = false\n',
        'source.sh': 'echo first\n',
    });
    expect(git(sandbox.path, ['init', '-q']).code).toBe(0);
    expect(git(sandbox.path, ['config', 'user.name', 'Alex Garcia']).code).toBe(0);
    expect(git(sandbox.path, ['config', 'user.email', 'alex.garcia@example.com']).code).toBe(0);
    expect(git(sandbox.path, ['add', '-A']).code).toBe(0);
    expect(git(sandbox.path, ['commit', '-qm', 'feat: first']).code).toBe(0);
    const first = git(sandbox.path, ['rev-parse', 'HEAD']).stdout.trim();
    writeFileSync(join(sandbox.path, 'source.sh'), 'echo second\n');
    expect(git(sandbox.path, ['commit', '-qam', 'feat: second']).code).toBe(0);
    const second = git(sandbox.path, ['rev-parse', 'HEAD']).stdout.trim();
    const marker = join(sandbox.path, 'started.json');
    const counter = join(sandbox.path, 'clones.txt');
    const nativeGit = Bun.which('git');
    expect(nativeGit).not.toBeNull();
    const shim = join(sandbox.path, 'bin');
    mkdirSync(shim);
    writeFileSync(
        join(shim, 'git'),
        `#!${process.execPath}\nconst args=process.argv.slice(2);\nif(args[0]==='clone'){\nconst file=Bun.file(${JSON.stringify(counter)});\nconst count=await file.exists()?Number(await file.text()):0;\nawait Bun.write(file,String(count+1));\nif(count===1){await Bun.write(${JSON.stringify(marker)},JSON.stringify({pid:process.pid,snapshot:args.at(-1)}));await Bun.sleep(60_000);}\n}\nconst child=Bun.spawn([${JSON.stringify(nativeGit)},...args],{stdin:'inherit',stdout:'inherit',stderr:'inherit'});\nprocess.exit(await child.exited);\n`,
        { mode: 0o755 },
    );
    const protocol = `refs/heads/first ${first} refs/heads/first ${'0'.repeat(40)}\nrefs/heads/second ${second} refs/heads/second ${'0'.repeat(40)}\n`;
    const child = Bun.spawn([process.execPath, CLI, 'check', '--push', '--only', 'bash/syntax', '--json'], {
        cwd: sandbox.path,
        env: { ...process.env, PATH: `${shim}:${process.env['PATH'] ?? ''}` },
        stdin: Buffer.from(protocol),
        stdout: 'pipe',
        stderr: 'pipe',
    });
    const output = new Response(child.stdout).text();
    const errors = new Response(child.stderr).text();
    try {
        const deadline = performance.now() + 10_000;
        while (!existsSync(marker) && performance.now() < deadline) await Bun.sleep(20);
        expect(existsSync(marker)).toBe(true);
        const started = JSON.parse(readFileSync(marker, 'utf8')) as { pid: number; snapshot: string };
        child.kill('SIGINT');
        expect(await child.exited, await errors).toBe(2);
        const report = pushReportSchema.parse(JSON.parse(await output));
        expect(report.revisions).toHaveLength(1);
        expect(report.revisions[0]?.object).toBe(first);
        expect(report.revisions[0]?.report.checks[0]?.status).toBe('ok');
        expect(report.canceled?.pendingRefs).toStrictEqual(['refs/heads/second']);
        const sarif = JSON.parse(readFileSync(join(sandbox.path, '.gspot/reports/report.sarif'), 'utf8'));
        expect(sarif.runs[0].invocations[0].executionSuccessful).toBe(true);
        expect(sarif.runs[1].invocations[0].executionSuccessful).toBe(false);
        expect(sarif.runs[1].properties.canceled.pendingRefs).toStrictEqual(['refs/heads/second']);
        expect(report.exitCode).toBe(2);
        expect(JSON.parse(readFileSync(join(sandbox.path, '.gspot/reports/report.json'), 'utf8'))).toStrictEqual(
            report,
        );
        expect(existsSync(started.snapshot)).toBe(false);
        expect(() => process.kill(started.pid, 0)).toThrow();
        expect(git(sandbox.path, ['rev-parse', 'HEAD']).stdout.trim()).toBe(second);
    } finally {
        if (child.exitCode === null) child.kill('SIGKILL');
        await child.exited;
        await output;
        await errors;
    }
}, 20_000);

test.each(['SIGINT', 'SIGTERM'] as const)(
    'push cancellation while stdin remains open handles %s and permits retry',
    async (signal) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': 'version = 1\nconfigurations = ["bash"]\n[rules]\ninstall = false\n',
            'source.sh': 'echo indexed\n',
        });
        expect(git(sandbox.path, ['init', '-q']).code).toBe(0);
        expect(git(sandbox.path, ['add', '-A']).code).toBe(0);
        const indexed = git(sandbox.path, ['ls-files', '--stage', '-z']).stdout;
        const started = join(sandbox.path, 'listening');
        const program = `
process.on('newListener',(name)=>{ if(name==='SIGTERM') require('node:fs').writeFileSync(${JSON.stringify(started)},'ready'); });
process.argv=[process.execPath,${JSON.stringify(CLI)},'check','--push','--json'];
await import(${JSON.stringify(CLI)});
`;
        const child = Bun.spawn([process.execPath, '-e', program], {
            cwd: sandbox.path,
            stdin: 'pipe',
            stdout: 'pipe',
            stderr: 'pipe',
        });
        const output = new Response(child.stdout).text();
        const errors = new Response(child.stderr).text();
        try {
            child.stdin.write('refs/heads/incomplete ');
            child.stdin.flush();
            const deadline = performance.now() + 10_000;
            while (!existsSync(started) && performance.now() < deadline) await Bun.sleep(20);
            expect(existsSync(started)).toBe(true);
            child.kill(signal);
            expect(await child.exited, await errors).toBe(2);
            expect(JSON.parse(await output)).toStrictEqual({ error: 'canceled', exitCode: 2 });
            expect(existsSync(join(sandbox.path, '.gspot/reports/report.json'))).toBe(false);
            expect(git(sandbox.path, ['ls-files', '--stage', '-z']).stdout).toBe(indexed);
            const retry = await run(sandbox.path, ['check', '--staged', '--only', 'bash/syntax', '--json']);
            expect(retry.code, retry.stdout + retry.stderr).toBe(0);
            expect(JSON.parse(retry.stdout).checks[0].status).toBe('ok');
        } finally {
            child.stdin.end();
            if (child.exitCode === null) child.kill('SIGKILL');
            await child.exited;
            await output;
            await errors;
        }
    },
    15_000,
);

test('staged cancellation during dependency copying removes partial output and preserves the installed source', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nconfigurations = ["bash"]\n[rules]\ninstall = false\n',
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
        writeFileSync(join(dependencies, `${index}.js`), `export const value=${index};\n`);
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
    const child = Bun.spawn([process.execPath, '-e', program], { cwd: sandbox.path, stdout: 'pipe', stderr: 'pipe' });
    const output = new Response(child.stdout).text();
    const errors = new Response(child.stderr).text();
    try {
        const deadline = performance.now() + 10_000;
        while (!existsSync(marker) && performance.now() < deadline) await Bun.sleep(5);
        expect(existsSync(marker)).toBe(true);
        const observed = JSON.parse(readFileSync(marker, 'utf8')) as { destination: string };
        child.kill('SIGTERM');
        expect(await child.exited, await errors).toBe(2);
        expect(JSON.parse(await output)).toStrictEqual({ error: 'canceled', exitCode: 2 });
        expect(existsSync(dirname(observed.destination))).toBe(false);
        expect(git(sandbox.path, ['ls-files', '--stage', '-z']).stdout).toBe(indexed);
        expect(readdirSync(dependencies)).toHaveLength(4000);
        expect(readFileSync(join(dependencies, '0.js'), 'utf8')).toBe('export const value=0;\n');
        expect(readFileSync(join(dependencies, '3999.js'), 'utf8')).toBe('export const value=3999;\n');
        const retry = await run(sandbox.path, ['check', '--staged', '--only', 'bash/syntax', '--json']);
        expect(retry.code, retry.stdout + retry.stderr).toBe(0);
        expect(JSON.parse(retry.stdout).checks[0].status).toBe('ok');
    } finally {
        if (child.exitCode === null) child.kill('SIGKILL');
        await child.exited;
        await output;
        await errors;
    }
}, 20_000);
