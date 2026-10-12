import which from 'which';
import { testdir } from 'testdirs';
import { join, basename } from 'node:path';
import * as tools from '#cli/tools/find.ts';
import { test, spyOn, expect } from 'bun:test';
import { executeRun } from '#cli/execution/run.ts';
import { pathExists } from '#tests/setup/files.ts';
import * as processes from '#cli/system/processes.ts';
import { openSession } from '#cli/commands/session.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { processResult } from '#tests/setup/processes.ts';
import { buildRunOptions } from '#tests/setup/run-gspot.ts';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

test('a failed frozen install leaves the repository unchanged and passes on retry', async () => {
    await using directory = await testdir({
        'gspot.toml': settingsText(['dependencies']),
        'package.json': '{"name":"example","private":true}\n',
        'bun.lock': 'original lockfile\n',
        'node_modules/protected.txt': 'installed dependency\n',
    });
    const session = await openSession(directory.path);
    const options = buildRunOptions({
        stage: 'push',

        only: ['dependencies/stale-lockfile'],
    });
    const copies: string[] = [];
    using spawn = spyOn(processes, 'run').mockImplementation(async (_command, options) => {
        copies.push(options.cwd);
        await writeFile(join(options.cwd, 'bun.lock'), 'partial installation\n');
        await mkdir(join(options.cwd, 'node_modules'), { recursive: true });
        await writeFile(join(options.cwd, 'node_modules/protected.txt'), 'replacement dependency\n');
        return processResult({ code: 1, stderr: 'Installation failed.', missing: false });
    });
    const outcome = await executeRun(session, options);
    const result = outcome.report.checks[0]!;
    expect(result.status).toBe('error');
    expect(result.note).toContain('Installation failed.');
    expect(result.findings).toStrictEqual([]);
    expect(await readFile(join(directory.path, 'bun.lock'), 'utf8')).toBe('original lockfile\n');
    expect(await readFile(join(directory.path, 'node_modules/protected.txt'), 'utf8')).toBe('installed dependency\n');
    expect(await Promise.all(copies.map((path) => pathExists(path)))).toStrictEqual(copies.map(() => false));
    spawn.mockResolvedValue(processResult());
    const retry = await executeRun(session, options);
    const fresh = retry.report.checks[0]!;
    expect(fresh.status).toBe('passed');
});

test('Yarn Berry runs install --immutable and leaves the lockfile unchanged', async () => {
    const files = {
        'gspot.toml': settingsText(['dependencies']),
        'package.json': '{"name":"example","private":true}\n',
        'yarn.lock': '__metadata:\n  version: 8\n',
    };
    await using directory = await testdir(files);
    using _inspection = spyOn(tools, 'inspectTool').mockReturnValue({ name: 'yarn', state: 'ok', path: 'yarn' });
    using yarn = spyOn(processes, 'run').mockResolvedValue(processResult());
    const session = await openSession(directory.path);
    const outcome = await executeRun(
        session,
        buildRunOptions({
            stage: 'push',

            only: ['dependencies/stale-lockfile'],
        }),
    );
    expect(outcome.report.checks[0]!.status).toBe('passed');
    expect(
        yarn.mock.calls.map(([[executable, ...commandArguments]]) => [basename(executable!), ...commandArguments]),
    ).toStrictEqual([['yarn', 'install', '--immutable']]);
    for (const [path, text] of Object.entries(files))
        expect(await readFile(join(directory.path, path), 'utf8')).toBe(text);
    expect(await Promise.all(yarn.mock.calls.map(([, options]) => pathExists(options.cwd)))).toStrictEqual([false]);
});

test("the scratch copy holds every scope's files and runs bun install --frozen-lockfile --dry-run", async () => {
    await using directory = await testdir({
        'gspot.toml': settingsText(['dependencies'], {
            level: 'recommended',
            tables: '[[scope]]\npath = "app"\nconfigurations = ["dependencies"]\n',
        }),
        'package.json': '{"name":"root","private":true}\n',
        'bun.lock': 'Original lockfile.\n',
        'source.txt': 'Root source.\n',
        'app/package.json': '{"name":"child","private":true}\n',
        'app/source.txt': 'Child source.\n',
    });
    const commands: string[][] = [];
    const inputs: string[][] = [];
    using _process = spyOn(processes, 'run').mockImplementation(async (command, options) => {
        commands.push([...command]);
        inputs.push(
            await Promise.all(
                ['source.txt', 'app/source.txt'].map((path) => readFile(join(options.cwd, path), 'utf8')),
            ),
        );
        return processResult();
    });
    const session = await openSession(directory.path);
    const options = { stage: 'push' as const, only: ['dependencies/stale-lockfile'] };
    const triggered = await executeRun(session, buildRunOptions(options));
    expect(triggered.report.checks).toMatchObject([{ check: 'dependencies/stale-lockfile', status: 'passed' }]);
    expect(commands).toStrictEqual([[which.sync('bun'), 'install', '--frozen-lockfile', '--dry-run']]);
    expect(inputs).toStrictEqual([['Root source.\n', 'Child source.\n']]);
});
