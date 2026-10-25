import executables from 'which';
import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { openSession } from '#cli/session.ts';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/system/processes.ts';
import { runChecks } from '#cli/commands/check/run.ts';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { writeProgramCommand, fakeExecutableLookup } from '#tests/setup/system/fakes.ts';

import {
    DATABASE_SCHEMAS,
    DOCKER_VERSION_OUTPUT,
    SUPABASE_TYPES_OUTPUT,
    SUPABASE_VERSION_OUTPUT,
    SUPABASE_PROJECT_FILE_SOURCE,
} from '#tests/config/checks/generator-outputs.ts';

async function prepareSupabaseCheck(
    root: string,
    scope: string,
    result: Awaited<ReturnType<typeof processes.spawnProcess>>,
    schemas?: readonly string[],
) {
    using resources = new DisposableStack();

    const prefix = scope === '' ? '' : `${scope}/`;
    const schemasLine = schemas === undefined ? '' : `schemas = ${JSON.stringify(schemas)}\n`;
    await createFileTree(root, {
        'gspot.toml': buildSandboxSettings(['supabase'], {
            scopes: scope === '' ? [] : [{ path: scope, configurations: ['supabase'] }],
            tables: `[${scope === '' ? '' : 'scope.'}supabase]\ntypes_file = "${prefix}database.ts"\n${schemasLine}`,
        }),
        [`${prefix}supabase/config.toml`]: SUPABASE_PROJECT_FILE_SOURCE,
    });
    const runStaleTypesCheck = async () => {
        const result = await runChecks(await openSession(root), buildRunOptions({ only: ['supabase/stale-types'] }));
        return result.report.checks.find((check) => check.scope === scope)!;
    };
    const bin = await writeProgramCommand(root, 'bin/supabase', 'fakes/tool');
    await writeProgramCommand(root, 'bin/docker', 'fakes/tool');
    const supabase = executables.sync('supabase', { path: bin });
    const docker = executables.sync('docker', { path: bin });
    const requests: { commandArguments: string[]; cwd: string }[] = [];
    const { spawnProcessBlocking: blocking, spawnProcess: spawn } = processes;
    resources.use(
        spyOn(processes, 'spawnProcessBlocking').mockImplementation((commandArguments, options) => {
            if (![supabase, docker].includes(commandArguments[0] ?? '')) return blocking(commandArguments, options);
            const stdout = commandArguments[0] === docker ? DOCKER_VERSION_OUTPUT : SUPABASE_VERSION_OUTPUT;
            return buildProcessResult({ stdout });
        }),
    );
    resources.use(
        fakeExecutableLookup((name) =>
            new Map([
                ['supabase', supabase],
                ['docker', docker],
            ]).get(name),
        ),
    );
    resources.use(
        spyOn(processes, 'spawnProcess').mockImplementation(async (commandArguments, options) => {
            if (commandArguments[0] !== supabase) return spawn(commandArguments, options);
            requests.push({ commandArguments: commandArguments.slice(1), cwd: options.cwd });
            return result;
        }),
    );
    const owned = resources.move();
    return {
        prefix,
        runCheck: runStaleTypesCheck,
        requests,
        [Symbol.dispose]: owned.dispose.bind(owned),
    };
}

test.each(['', 'apps/api'])(
    'Supabase passes every configured schema as its own --schema, in the root and in a scope (%s)',
    async (scope) => {
        await using sandbox = await testdir();
        using supabase = await prepareSupabaseCheck(
            sandbox.path,
            scope,
            buildProcessResult({ stdout: SUPABASE_TYPES_OUTPUT }),
            DATABASE_SCHEMAS,
        );
        await writeFile(join(sandbox.path, supabase.prefix, 'database.ts'), SUPABASE_TYPES_OUTPUT);
        expect(await supabase.runCheck()).toMatchObject({ status: 'passed', findings: [] });
        const request = supabase.requests[0]!;
        expect(request.cwd).not.toBe(join(sandbox.path, scope));
        expect(await isOnDisk(request.cwd)).toBe(false);
        expect(supabase.requests).toStrictEqual([
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
    },
);

test('Supabase types need Docker before the local stack starts', async () => {
    using resources = new DisposableStack();

    await using sandbox = await testdir();
    using supabase = await prepareSupabaseCheck(
        sandbox.path,
        '',
        buildProcessResult({ stdout: SUPABASE_TYPES_OUTPUT }),
    );
    await writeFile(join(sandbox.path, 'database.ts'), SUPABASE_TYPES_OUTPUT);
    resources.use(fakeExecutableLookup((name) => (name === 'supabase' ? '/sandbox/supabase' : null)));

    expect(await supabase.runCheck()).toMatchObject({
        status: 'missing',
        note: 'Docker is not installed. Install Docker to run this check.',
    });
    expect(supabase.requests).toStrictEqual([]);
});
