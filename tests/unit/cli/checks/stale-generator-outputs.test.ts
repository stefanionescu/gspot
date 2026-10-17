import executables from 'which';
import { join } from 'node:path';
import { openSession } from '#cli/session.ts';
import { test, spyOn, expect } from 'bun:test';
import { commitAll } from '#tests/setup/git.ts';
import { isOnDisk } from '#tests/setup/files.ts';
import { runChecks } from '#cli/checks/run/run.ts';
import { chmod, readFile } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/system/processes.ts';
import { useExecutable } from '#tests/setup/processes.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { EXECUTABLE_FILE } from '#cli/config/system/modes.ts';
import { buildCheckInput } from '#tests/setup/check-input.ts';
import { readManifests } from '#cli/configurations/manifests.ts';
import { getToolDeclaration } from '#cli/configurations/tools.ts';
import { fakeTool, fakePinnedExecutables } from '#tests/setup/fakes.ts';
import { buildRunOptions, buildProcessResult } from '#tests/setup/builders.ts';
import { checkStaleGeneratorOutputs } from '#cli/checks/stale-generator-outputs.ts';
import { GENERATOR_CASES, GENERATOR_SCRIPT, SUPABASE_TYPES_OUTPUT } from '#tests/data/checks/generator-outputs.ts';

import {
    DATABASE_SCHEMAS,
    DOCKER_VERSION_OUTPUT,
    SUPABASE_PROJECT_CONFIG,
    SUPABASE_VERSION_OUTPUT,
} from '#tests/data/checks/supabase.ts';

async function writeGeneratorProject(root: string, row: (typeof GENERATOR_CASES)[number]) {
    await createFileTree(root, {
        'gspot.toml': buildSettingsText([row.configuration], { tables: row.tables }),
        'package.json': '{"private":true}\n',
        'generate.ts': GENERATOR_SCRIPT,
        'schema.txt': 'failure',
        'drizzle.config.ts': 'export default {};\n',
        'notes.txt': 'Keep project notes\n',
        [row.output]: 'original',
    });
    commitAll(root);
    await Bun.write(join(root, row.output), 'dirty');
    await Bun.write(join(root, 'untracked.txt'), 'Keep untracked notes\n');
    const input = buildCheckInput(await openSession(root), row.check);
    return { ...input, check: { ...input.check, command: ['bun', 'generate.ts', row.output] } };
}

test.each([...GENERATOR_CASES])(
    '$configuration generator reports a failed run and a stale file and leaves the files unchanged',
    async (row) => {
        await using sandbox = await testdir();
        const input = await writeGeneratorProject(sandbox.path, row);
        expect(await captureRejection(checkStaleGeneratorOutputs(input))).toContain('Generation failed');
        await Bun.write(join(sandbox.path, 'schema.txt'), 'changed');
        const findings = await checkStaleGeneratorOutputs(input);
        expect(findings.map(({ check, file, rule }) => ({ check, file, rule }))).toEqual([
            { check: row.check, file: row.output, rule: 'stale' },
        ]);
        await Bun.write(join(sandbox.path, 'schema.txt'), 'dirty');
        expect(await checkStaleGeneratorOutputs(input)).toEqual([]);
        expect(await readFile(join(sandbox.path, row.output), 'utf8')).toBe('dirty');
        expect(await readFile(join(sandbox.path, 'notes.txt'), 'utf8')).toBe('Keep project notes\n');
        expect(await readFile(join(sandbox.path, 'untracked.txt'), 'utf8')).toBe('Keep untracked notes\n');
    },
);

test('a missing OpenAPI document is reported before generation', async () => {
    using resources = new DisposableStack();

    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSettingsText(['openapi'], {
            tables: '[openapi]\ndocument = "openapi.json"\ngenerate_command = ["bun", "generate.ts"]\n',
        }),
        'generate.ts': '',
    });
    const input = buildCheckInput(await openSession(sandbox.path), 'openapi/stale-document');
    const run = resources.use(spyOn(processes, 'spawnProcess'));
    expect(await checkStaleGeneratorOutputs(input)).toMatchObject([
        {
            file: 'openapi.json',
            rule: 'missing',
            message: 'The file openapi.json does not exist; run bun generate.ts and commit what it writes.',
        },
    ]);
    expect(run).not.toHaveBeenCalled();
});

async function mockWrangler(root: string): Promise<DisposableStack> {
    const pin = getToolDeclaration(readManifests(createReadCache(process.cwd())).values(), 'wrangler');
    const path = join(root, 'node_modules', '.bin', pin.name);
    await Bun.write(path, '');
    await chmod(path, EXECUTABLE_FILE);
    return fakePinnedExecutables([pin]);
}

test('custom Worker type settings reach wrangler types as --env-interface', async () => {
    await using sandbox = await testdir();
    const source = 'interface CloudflareEnv {}\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSettingsText([], {
            tables: '[[scope]]\npath = "workers/api"\nconfigurations = ["cloudflare"]\n[scope.cloudflare]\ntypes_file = "workers/api/cloudflare-env.d.ts"\ntypes_interface = "CloudflareEnv"\n',
        }),
        'workers/api/cloudflare-env.d.ts': source,
    });
    const session = await openSession(sandbox.path);
    using resources = new DisposableStack();
    resources.use(await mockWrangler(sandbox.path));
    const folders: string[] = [];
    resources.use(
        spyOn(processes, 'spawnProcess').mockImplementation(async (commandArguments, options) => {
            expect(commandArguments.slice(1)).toStrictEqual([
                'types',
                'cloudflare-env.d.ts',
                '--env-interface',
                'CloudflareEnv',
            ]);
            folders.push(options.cwd);
            await Bun.write(join(options.cwd, 'cloudflare-env.d.ts'), source);
            return buildProcessResult();
        }),
    );
    expect(
        await checkStaleGeneratorOutputs(buildCheckInput(session, 'cloudflare/stale-types', { scope: 'workers/api' })),
    ).toStrictEqual([]);
    expect(folders).toHaveLength(1);
    expect(folders[0]).not.toBe(join(sandbox.path, 'workers/api'));
    expect(await isOnDisk(folders[0]!)).toBe(false);
    expect(await readFile(join(sandbox.path, 'workers/api/cloudflare-env.d.ts'), 'utf8')).toBe(source);
});

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
        'gspot.toml': buildSettingsText(['supabase'], {
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

test.each(['', 'apps/api'])('Supabase passes every configured schema as its own --schema', async (scope) => {
    await using sandbox = await testdir();
    using fixture = await prepareSupabaseCheck(
        sandbox.path,
        scope,
        buildProcessResult({ stdout: SUPABASE_TYPES_OUTPUT }),
        DATABASE_SCHEMAS,
    );
    await Bun.write(join(sandbox.path, fixture.prefix, 'database.ts'), SUPABASE_TYPES_OUTPUT);
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
    await Bun.write(join(sandbox.path, 'database.ts'), SUPABASE_TYPES_OUTPUT);
    resources.use(useExecutable((name) => (name === 'supabase' ? '/fixture/supabase' : null)));

    expect(await fixture.execute()).toMatchObject({
        status: 'missing',
        note: 'Docker has no installation. Install Docker to run this check.',
    });
    expect(fixture.requests).toStrictEqual([]);
});
