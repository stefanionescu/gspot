import executables from 'which';
import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { commitAll } from '#tests/setup/git.ts';
import { executeRun } from '#cli/execution/run.ts';
import { pathExists } from '#tests/setup/files.ts';
import { chmod, readFile } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { fakeTool } from '#tests/setup/fake-tool.ts';
import * as processes from '#cli/system/processes.ts';
import { openSession } from '#cli/commands/session.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { processResult } from '#tests/setup/processes.ts';
import { buildRunOptions } from '#tests/setup/run-gspot.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { mockPinnedExecutables } from '#tests/setup/pins.ts';
import { EXECUTABLE_FILE } from '#cli/config/system/modes.ts';
import { buildCheckInput } from '#tests/setup/check-input.ts';
import { readManifests } from '#cli/configurations/manifests.ts';
import { getToolDeclaration } from '#cli/configurations/tools.ts';
import { staleGeneratedFiles } from '#cli/checks/stale-generated-files.ts';
import { GENERATOR_CASES, GENERATOR_SCRIPT } from '#tests/config/generated-files.ts';

import {
    GENERATED_TYPES,
    DATABASE_SCHEMAS,
    DOCKER_VERSION_OUTPUT,
    SUPABASE_VERSION_OUTPUT,
    SUPABASE_PROJECT_CONFIG,
} from '#tests/config/supabase.ts';

async function writeGeneratorProject(root: string, row: (typeof GENERATOR_CASES)[number]) {
    await createFileTree(root, {
        'gspot.toml': settingsText([row.configuration], { tables: row.tables }),
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
        expect(staleGeneratedFiles(input)).rejects.toThrow('Generation failed');
        await Bun.write(join(sandbox.path, 'schema.txt'), 'changed');
        const findings = await staleGeneratedFiles(input);
        expect(findings.map(({ check, file, rule }) => ({ check, file, rule }))).toEqual([
            { check: row.check, file: row.output, rule: 'stale' },
        ]);
        await Bun.write(join(sandbox.path, 'schema.txt'), 'dirty');
        expect(await staleGeneratedFiles(input)).toEqual([]);
        expect(await readFile(join(sandbox.path, row.output), 'utf8')).toBe('dirty');
        expect(await readFile(join(sandbox.path, 'notes.txt'), 'utf8')).toBe('Keep project notes\n');
        expect(await readFile(join(sandbox.path, 'untracked.txt'), 'utf8')).toBe('Keep untracked notes\n');
    },
);

test('a missing OpenAPI document is reported before generation', async () => {
    using resources = new DisposableStack();

    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['openapi'], {
            tables: '[openapi]\ndocument = "openapi.json"\ngenerate_command = ["bun", "generate.ts"]\n',
        }),
        'generate.ts': '',
    });
    const input = buildCheckInput(await openSession(sandbox.path), 'openapi/stale-document');
    const run = resources.use(spyOn(processes, 'spawnProcess'));
    expect(await staleGeneratedFiles(input)).toMatchObject([
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
    return mockPinnedExecutables([pin]);
}

test('custom Worker type settings reach wrangler types as --env-interface', async () => {
    await using sandbox = await testdir();
    const source = 'interface CloudflareEnv {}\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText([], {
            tables: '[[scope]]\npath = "workers/api"\nconfigurations = ["cloudflare"]\n[scope.cloudflare]\ntypes_file = "workers/api/cloudflare-env.d.ts"\ntypes_interface = "CloudflareEnv"\n',
        }),
        'workers/api/cloudflare-env.d.ts': source,
    });
    const session = await openSession(sandbox.path);
    using resources = new DisposableStack();
    resources.use(await mockWrangler(sandbox.path));
    const directories: string[] = [];
    resources.use(
        spyOn(processes, 'spawnProcess').mockImplementation(async (argv, options) => {
            expect(argv.slice(1)).toStrictEqual(['types', 'cloudflare-env.d.ts', '--env-interface', 'CloudflareEnv']);
            directories.push(options.cwd);
            await Bun.write(join(options.cwd, 'cloudflare-env.d.ts'), source);
            return processResult();
        }),
    );
    expect(
        await staleGeneratedFiles(buildCheckInput(session, 'cloudflare/stale-types', { scope: 'workers/api' })),
    ).toStrictEqual([]);
    expect(directories).toHaveLength(1);
    expect(directories[0]).not.toBe(join(sandbox.path, 'workers/api'));
    expect(await pathExists(directories[0]!)).toBe(false);
    expect(await readFile(join(sandbox.path, 'workers/api/cloudflare-env.d.ts'), 'utf8')).toBe(source);
});

async function prepareSupabaseCheck(
    root: string,
    scope: string,
    outcome: Awaited<ReturnType<typeof processes.spawnProcess>>,
    schemas?: readonly string[],
) {
    using resources = new DisposableStack();

    const prefix = scope === '' ? '' : `${scope}/`;
    const settings =
        scope === '' ? '[supabase]' : `[[scope]]\npath = "${scope}"\nconfigurations = ["supabase"]\n[scope.supabase]`;
    const declared = schemas === undefined ? '' : `schemas = ${JSON.stringify(schemas)}\n`;
    await createFileTree(root, {
        'gspot.toml': settingsText(['supabase'], {
            tables: `${settings}\ntypes_file = "${prefix}database.ts"\n${declared}`,
        }),
        [`${prefix}supabase/config.toml`]: SUPABASE_PROJECT_CONFIG,
    });
    const execute = async () => {
        const outcome = await executeRun(await openSession(root), buildRunOptions({ only: ['supabase/stale-types'] }));
        return outcome.report.checks.find((check) => check.scope === scope)!;
    };
    const bin = await fakeTool(root, 'bin/supabase', '');
    await fakeTool(root, 'bin/docker', '');
    const supabase = executables.sync('supabase', { path: bin });
    const docker = executables.sync('docker', { path: bin });
    const requests: { args: string[]; cwd: string }[] = [];
    const { spawnProcessBlocking: blocking, spawnProcess: executeProcess } = processes;
    resources.use(
        spyOn(processes, 'spawnProcessBlocking').mockImplementation((argv, options) =>
            [supabase, docker].includes(argv[0] ?? '')
                ? processResult({ stdout: argv[0] === docker ? DOCKER_VERSION_OUTPUT : SUPABASE_VERSION_OUTPUT })
                : blocking(argv, options),
        ),
    );
    const findExecutable = executables.sync;
    resources.use(
        spyOn(executables, 'sync').mockImplementation(((
            name: string,
            options?: executables.Options,
            // eslint-disable-next-line sonarjs/function-return-type -- which.sync returns one path, all paths, or null.
        ): string | string[] | null => {
            if (name !== 'supabase' && name !== 'docker') return findExecutable(name, options);
            const path = name === 'supabase' ? supabase : docker;
            return options?.all === true ? [path] : path;
        }) as typeof executables.sync),
    );
    resources.use(
        spyOn(processes, 'spawnProcess').mockImplementation(async (argv, options) => {
            if (argv[0] !== supabase) return executeProcess(argv, options);
            requests.push({ args: argv.slice(1), cwd: options.cwd });
            return outcome;
        }),
    );
    const owned = resources.move();
    return {
        prefix,
        execute,
        requests,
        [Symbol.dispose]: owned.dispose.bind(owned),
    };
}

test.each(['', 'apps/api'])('Supabase passes every configured schema as its own --schema', async (scope) => {
    await using sandbox = await testdir();
    using fixture = await prepareSupabaseCheck(
        sandbox.path,
        scope,
        processResult({ stdout: GENERATED_TYPES }),
        DATABASE_SCHEMAS,
    );
    await Bun.write(join(sandbox.path, fixture.prefix, 'database.ts'), GENERATED_TYPES);
    expect(await fixture.execute()).toMatchObject({ status: 'passed', findings: [] });
    const request = fixture.requests[0]!;
    expect(request.cwd).not.toBe(join(sandbox.path, scope));
    expect(await pathExists(request.cwd)).toBe(false);
    expect(fixture.requests).toStrictEqual([
        {
            args: [
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
    using fixture = await prepareSupabaseCheck(sandbox.path, '', processResult({ stdout: GENERATED_TYPES }));
    await Bun.write(join(sandbox.path, 'database.ts'), GENERATED_TYPES);
    resources.use(
        spyOn(executables, 'sync').mockImplementation(((
            name: string,
            options?: executables.Options,
        ): string | string[] | null => {
            if (name !== 'supabase') return null;
            return options?.all === true ? ['/fixture/supabase'] : '/fixture/supabase';
        }) as typeof executables.sync),
    );

    expect(await fixture.execute()).toMatchObject({
        status: 'missing',
        note: 'Docker has no installation. Install Docker to run this check.',
    });
    expect(fixture.requests).toStrictEqual([]);
});
