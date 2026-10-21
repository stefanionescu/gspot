import executables from 'which';
import { join, dirname } from 'node:path';
import { openSession } from '#cli/session.ts';
import { test, spyOn, expect } from 'bun:test';
import { commitAll } from '#tests/setup/git.ts';
import { isOnDisk } from '#tests/setup/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { findCheckCode } from '#cli/checks/code.ts';
import * as processes from '#cli/system/processes.ts';
import { getTable } from '#cli/settings/scope-view.ts';
import { useExecutable } from '#tests/setup/processes.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { EXECUTABLE_FILE } from '#cli/config/system/modes.ts';
import { planSandboxCheck } from '#tests/setup/check-input.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { runChecks, runCheckCode } from '#cli/commands/check/run.ts';
import { mkdir, chmod, readFile, writeFile } from 'node:fs/promises';
import { fakeTool, fakePinnedExecutables } from '#tests/setup/fakes.ts';
import { getShippedTool, buildRunOptions, buildProcessResult } from '#tests/setup/builders.ts';
import { GENERATOR_CASES, GENERATOR_SCRIPT, SUPABASE_TYPES_OUTPUT } from '#tests/data/checks/generator-outputs.ts';

import {
    DATABASE_SCHEMAS,
    DOCKER_VERSION_OUTPUT,
    SUPABASE_PROJECT_CONFIG,
    SUPABASE_VERSION_OUTPUT,
} from '#tests/data/checks/supabase.ts';

async function prepareGeneratorCheck(root: string, row: (typeof GENERATOR_CASES)[number]) {
    await createFileTree(root, {
        'gspot.toml': buildSandboxSettings([row.configuration], { tables: row.tables }),
        'package.json': '{"private":true}\n',
        'generate.ts': GENERATOR_SCRIPT,
        'schema.txt': 'failure',
        'drizzle.config.ts': 'export default {};\n',
        'notes.txt': 'Keep project notes\n',
        [row.output]: 'original',
    });
    commitAll(root);
    await writeFile(join(root, row.output), 'dirty');
    await writeFile(join(root, 'untracked.txt'), 'Keep untracked notes\n');
    const session = await openSession(root);
    const input = planSandboxCheck(session, row.check);
    return { session, planned: { ...input, check: { ...input.check, command: ['bun', 'generate.ts', row.output] } } };
}

async function mockWrangler(root: string): Promise<DisposableStack> {
    const pin = getShippedTool('wrangler');
    const path = join(root, 'node_modules', '.bin', pin.name);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, '');
    await chmod(path, EXECUTABLE_FILE);
    return fakePinnedExecutables([pin]);
}

function spyOnWranglerTypes(source: string) {
    return spyOn(processes, 'spawnProcess').mockImplementation(async (_commandArguments, options) => {
        await writeFile(join(options.cwd, 'cloudflare-env.d.ts'), source);
        return buildProcessResult();
    });
}

async function prepareSupabaseCheck(
    root: string,
    scope: string,
    result: Awaited<ReturnType<typeof processes.spawnProcess>>,
    schemas?: readonly string[],
) {
    using resources = new DisposableStack();

    const prefix = scope === '' ? '' : `${scope}/`;
    const settings =
        scope === '' ? '[supabase]' : `[[scope]]\npath = "${scope}"\nconfigurations = ["supabase"]\n[scope.supabase]`;
    const declared = schemas === undefined ? '' : `schemas = ${JSON.stringify(schemas)}\n`;
    await createFileTree(root, {
        'gspot.toml': buildSandboxSettings(['supabase'], {
            tables: `${settings}\ntypes_file = "${prefix}database.ts"\n${declared}`,
        }),
        [`${prefix}supabase/config.toml`]: SUPABASE_PROJECT_CONFIG,
    });
    const collectCheckResult = async () => {
        const result = await runChecks(await openSession(root), buildRunOptions({ only: ['supabase/stale-types'] }));
        return result.report.checks.find((check) => check.scope === scope)!;
    };
    const bin = await fakeTool(root, 'bin/supabase', '');
    await fakeTool(root, 'bin/docker', '');
    const supabase = executables.sync('supabase', { path: bin });
    const docker = executables.sync('docker', { path: bin });
    const requests: { commandArguments: string[]; cwd: string }[] = [];
    const { spawnProcessBlocking: blocking, spawnProcess: executeProcess } = processes;
    resources.use(
        spyOn(processes, 'spawnProcessBlocking').mockImplementation((commandArguments, options) => {
            if (![supabase, docker].includes(commandArguments[0] ?? '')) return blocking(commandArguments, options);
            const stdout = commandArguments[0] === docker ? DOCKER_VERSION_OUTPUT : SUPABASE_VERSION_OUTPUT;
            return buildProcessResult({ stdout });
        }),
    );
    resources.use(
        useExecutable((name) =>
            new Map([
                ['supabase', supabase],
                ['docker', docker],
            ]).get(name),
        ),
    );
    resources.use(
        spyOn(processes, 'spawnProcess').mockImplementation(async (commandArguments, options) => {
            if (commandArguments[0] !== supabase) return executeProcess(commandArguments, options);
            requests.push({ commandArguments: commandArguments.slice(1), cwd: options.cwd });
            return result;
        }),
    );
    const owned = resources.move();
    return {
        prefix,
        execute: collectCheckResult,
        requests,
        [Symbol.dispose]: owned.dispose.bind(owned),
    };
}

test.each([...GENERATOR_CASES])(
    '$configuration generator reports a failed run and a stale file and leaves the files unchanged',
    async (row) => {
        await using sandbox = await testdir();
        const { session, planned } = await prepareGeneratorCheck(sandbox.path, row);
        expect(await captureRejection(runCheckCode(session, planned, findCheckCode(planned.check)))).toContain(
            'Generation failed',
        );
        await writeFile(join(sandbox.path, 'schema.txt'), 'changed');
        const staleResult = await runCheckCode(session, planned, findCheckCode(planned.check));
        const findings = staleResult.findings;
        expect(findings.map(({ check, file, rule }) => ({ check, file, rule }))).toEqual([
            { check: row.check, file: row.output, rule: 'stale' },
        ]);
        await writeFile(join(sandbox.path, 'schema.txt'), 'dirty');
        const currentResult = await runCheckCode(session, planned, findCheckCode(planned.check));
        expect(currentResult.findings).toEqual([]);
        expect(await readFile(join(sandbox.path, row.output), 'utf8')).toBe('dirty');
        expect(await readFile(join(sandbox.path, 'notes.txt'), 'utf8')).toBe('Keep project notes\n');
        expect(await readFile(join(sandbox.path, 'untracked.txt'), 'utf8')).toBe('Keep untracked notes\n');
    },
);

test('a missing OpenAPI document is reported before generation', async () => {
    using resources = new DisposableStack();

    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['openapi'], {
            tables: '[openapi]\ndocument = "openapi.json"\ngenerate_command = ["bun", "generate.ts"]\n',
        }),
        'generate.ts': '',
    });

    const session = await openSession(sandbox.path);
    const input = planSandboxCheck(session, 'openapi/stale-document');
    const run = resources.use(spyOn(processes, 'spawnProcess'));
    const missingResult = await runCheckCode(session, input, findCheckCode(input.check));
    expect(missingResult.findings).toMatchObject([
        {
            file: 'openapi.json',
            rule: 'missing',
            message: 'The file openapi.json does not exist; run bun generate.ts and commit what it writes.',
        },
    ]);
    expect(run).not.toHaveBeenCalled();
});

test('custom Worker type settings reach wrangler types as --env-interface', async () => {
    await using sandbox = await testdir();
    const source = 'interface CloudflareEnv {}\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings([], {
            scopes: [{ path: 'workers/api', configurations: ['cloudflare'] }],
            tables: '[scope.cloudflare]\ntypes_file = "workers/api/cloudflare-env.d.ts"\ntypes_interface = "CloudflareEnv"\n',
        }),
        'workers/api/cloudflare-env.d.ts': source,
    });
    const session = await openSession(sandbox.path);
    using resources = new DisposableStack();
    resources.use(await mockWrangler(sandbox.path));
    const run = resources.use(spyOnWranglerTypes(source));
    const workerResult = await runCheckCode(
        session,
        planSandboxCheck(session, 'cloudflare/stale-types', { scope: 'workers/api' }),
        findCheckCode(planSandboxCheck(session, 'cloudflare/stale-types', { scope: 'workers/api' }).check),
    );
    expect(workerResult.findings).toStrictEqual([]);
    expect(run.mock.calls.map(([command]) => command.slice(1))).toStrictEqual([
        ['types', 'cloudflare-env.d.ts', '--env-interface', 'CloudflareEnv'],
    ]);
    const folders = run.mock.calls.map(([, options]) => options.cwd);
    expect(folders).toHaveLength(1);
    expect(folders[0]).not.toBe(join(sandbox.path, 'workers/api'));
    expect(await isOnDisk(folders[0]!)).toBe(false);
    expect(await readFile(join(sandbox.path, 'workers/api/cloudflare-env.d.ts'), 'utf8')).toBe(source);
});

test('an OpenNext project checks cloudflare-env.d.ts against CloudflareEnv, and reports the file until Git tracks it', async () => {
    await using sandbox = await testdir();
    const source = 'interface CloudflareEnv {}\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings(['cloudflare']),
        'package.json': JSON.stringify({ private: true, devDependencies: { '@opennextjs/cloudflare': '1.0.0' } }),
        'wrangler.jsonc': '{ "name": "shop" }\n',
    });
    commitAll(sandbox.path);
    await writeFile(join(sandbox.path, 'cloudflare-env.d.ts'), source);
    using resources = new DisposableStack();
    resources.use(await mockWrangler(sandbox.path));
    const run = resources.use(spyOnWranglerTypes(source));
    const untracked = await openSession(sandbox.path);
    expect(getTable(untracked.scopes[0]!.view, 'cloudflare')).toStrictEqual({
        types_file: 'cloudflare-env.d.ts',
        types_interface: 'CloudflareEnv',
    });
    const untrackedResult = await runCheckCode(
        untracked,
        planSandboxCheck(untracked, 'cloudflare/stale-types'),
        findCheckCode(planSandboxCheck(untracked, 'cloudflare/stale-types').check),
    );
    expect(untrackedResult.findings).toMatchObject([
        {
            file: 'cloudflare-env.d.ts',
            rule: 'untracked',
            message: 'cloudflare-env.d.ts is not tracked. Commit it, so the other checks and this check can read it.',
        },
    ]);
    expect(run).not.toHaveBeenCalled();
    commitAll(sandbox.path);
    const tracked = await openSession(sandbox.path);
    const trackedResult = await runCheckCode(
        tracked,
        planSandboxCheck(tracked, 'cloudflare/stale-types'),
        findCheckCode(planSandboxCheck(tracked, 'cloudflare/stale-types').check),
    );
    expect(trackedResult.findings).toStrictEqual([]);
    expect(run.mock.calls.map(([command]) => command.slice(1))).toStrictEqual([
        ['types', 'cloudflare-env.d.ts', '--env-interface', 'CloudflareEnv'],
    ]);
});

test.each(['', 'apps/api'])('Supabase passes every configured schema as its own --schema', async (scope) => {
    await using sandbox = await testdir();
    using fixture = await prepareSupabaseCheck(
        sandbox.path,
        scope,
        buildProcessResult({ stdout: SUPABASE_TYPES_OUTPUT }),
        DATABASE_SCHEMAS,
    );
    await writeFile(join(sandbox.path, fixture.prefix, 'database.ts'), SUPABASE_TYPES_OUTPUT);
    expect(await fixture.execute()).toMatchObject({ status: 'passed', findings: [] });
    const request = fixture.requests[0]!;
    expect(request.cwd).not.toBe(join(sandbox.path, scope));
    expect(await isOnDisk(request.cwd)).toBe(false);
    expect(fixture.requests).toStrictEqual([
        {
            commandArguments: [
                'gen',
                'types',
                'typescript',
                '--local',
                ...DATABASE_SCHEMAS.flatMap((schema) => ['--schema', schema]),
            ],
            cwd: request.cwd,
        },
    ]);
});

test('Supabase types need Docker before the local stack starts', async () => {
    using resources = new DisposableStack();

    await using sandbox = await testdir();
    using fixture = await prepareSupabaseCheck(sandbox.path, '', buildProcessResult({ stdout: SUPABASE_TYPES_OUTPUT }));
    await writeFile(join(sandbox.path, 'database.ts'), SUPABASE_TYPES_OUTPUT);
    resources.use(useExecutable((name) => (name === 'supabase' ? '/fixture/supabase' : null)));

    expect(await fixture.execute()).toMatchObject({
        status: 'missing',
        note: 'Docker is not installed. Install Docker to run this check.',
    });
    expect(fixture.requests).toStrictEqual([]);
});

test('a [[command_check]] with outputs reports an output that differs from what its command writes', async () => {
    await using sandbox = await testdir();
    const generator = JSON.stringify([
        process.execPath,
        '-e',
        String.raw`require("node:fs").writeFileSync("generated/api.ts", "export const version = 2;\n");`,
    ]);
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings([], {
            tables: `[[command_check]]\nname = "project/codegen"\ncommand = ${generator}\npaths = ["schema/**"]\noutputs = ["generated/api.ts"]\nstage = "commit"\n`,
        }),
        'schema/api.json': '{"version":2}\n',
        'generated/api.ts': 'export const version = 1;\n',
    });
    commitAll(sandbox.path);
    const stale = await runChecks(await openSession(sandbox.path), buildRunOptions({ only: ['project/codegen'] }));
    expect(
        stale.report.checks.flatMap(({ findings }) => findings.map(({ file, rule }) => ({ file, rule }))),
    ).toStrictEqual([{ file: 'generated/api.ts', rule: 'stale' }]);
    expect(await readFile(join(sandbox.path, 'generated/api.ts'), 'utf8')).toBe('export const version = 1;\n');
    await writeFile(join(sandbox.path, 'generated/api.ts'), 'export const version = 2;\n');
    const fresh = await runChecks(await openSession(sandbox.path), buildRunOptions({ only: ['project/codegen'] }));
    expect(fresh.report.failed).toStrictEqual([]);
});
