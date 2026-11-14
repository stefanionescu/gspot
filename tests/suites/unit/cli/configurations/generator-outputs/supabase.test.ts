import executables from 'which';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { createFileTree } from 'testdirs';
import { writeFile } from 'node:fs/promises';
import { test, spyOn, expect } from 'bun:test';
import { openSession } from '#cli/engine/session.ts';
import { runChecks } from '#cli/engine/run/checks.ts';
import * as processes from '#cli/system/processes/run.ts';
import { buildRunOptions } from '#tests/setup/cli/run.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { fakeExecutableLookup } from '#tests/setup/system/fakes.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { writeProgramCommand } from '#tests/setup/system/programs.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

const DATABASE_SCHEMAS = ['public', 'private', 'audit'] as const;

const SUPABASE_TYPES_OUTPUT = 'export type Database = { public: { Tables: {} } };\n';

async function prepareSupabaseCheck(
    root: string,
    scopePath: string,
    result: Awaited<ReturnType<typeof processes.runProcess>>,
    schemas?: readonly string[],
) {
    using resources = new DisposableStack();

    const prefix = scopePath === '' ? '' : `${scopePath}/`;
    const schemasLine = schemas === undefined ? '' : `schemas = ${JSON.stringify(schemas)}\n`;
    await createFileTree(root, {
        'gspot.toml': buildSandboxSettings(['supabase'], {
            scopes: scopePath === '' ? [] : [{ path: scopePath, configurations: ['supabase'] }],
            tables: `[${scopePath === '' ? '' : 'scope.'}supabase]\ntypes_file = "database.ts"\n${schemasLine}`,
        }),
        [`${prefix}supabase/config.toml`]: 'project_id = "types-sample"\n',
    });
    const runStaleTypesCheck = async () => {
        const result = await runChecks(await openSession(root), buildRunOptions({ only: ['supabase/stale-types'] }));
        return result.report.checks.find((check) => check.scope === scopePath)!;
    };
    const bin = await writeProgramCommand(root, 'bin/supabase', 'fakes/tool');
    await writeProgramCommand(root, 'bin/docker', 'fakes/tool');
    const supabase = executables.sync('supabase', { path: bin });
    const docker = executables.sync('docker', { path: bin });
    const versions = new Map([
        [supabase, '2.75.0\n'],
        [docker, 'Docker version 29.2.1\n'],
    ]);
    const requests: Array<{ commandArguments: string[]; cwd: string }> = [];
    const { runProcess: spawn } = processes;
    resources.use(
        fakeExecutableLookup((name) =>
            new Map([
                ['supabase', supabase],
                ['docker', docker],
            ]).get(name),
        ),
    );
    resources.use(
        spyOn(processes, 'runProcess').mockImplementation(async (commandArguments, options) => {
            const [program = ''] = commandArguments;
            const version = versions.get(program);
            if (version !== undefined && commandArguments.at(-1) === '--version')
                return buildProcessResult({ stdout: version });
            if (program !== supabase) return spawn(commandArguments, options);
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

test('Supabase passes every configured schema as its own --schema in a scope', async () => {
    const scope = 'apps/api';
    await using sandbox = await createGitSandbox({});
    using supabase = await prepareSupabaseCheck(
        sandbox.path,
        scope,
        buildProcessResult({ stdout: SUPABASE_TYPES_OUTPUT }),
        DATABASE_SCHEMAS,
    );
    await writeFile(join(sandbox.path, supabase.prefix, 'database.ts'), SUPABASE_TYPES_OUTPUT);
    expect(await supabase.runCheck()).toMatchObject({ status: 'passed', findings: [] });
    const request = supabase.requests[0]!;
    expect(existsSync(request.cwd)).toBe(false);
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
});
