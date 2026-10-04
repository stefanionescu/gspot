import { isCI } from 'std-env';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { test, expect } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { parse, stringify } from 'smol-toml';
import { executeRun } from '#cli/execution/run.ts';
import { testdir, createFileTree } from 'testdirs';
import { isRecord } from '#cli/platform/objects.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/execution/session.ts';
import { buildRunOptions } from '#tests/harness/gspot.ts';
import { hasLinuxDocker } from '#tests/harness/docker.ts';
import { runTestCommand } from '#tests/harness/command.ts';
import { environmentVariables } from '#cli/platform/environment.ts';
import type { SupabaseDatabase, SupabaseProjectFiles } from '#tests/types/tools/checks/supabase/types.ts';
import { NESTED_POLICY, API_MIGRATIONS, WEB_MIGRATIONS } from '#tests/config/tools/checks/supabase/types.ts';

import {
    DATABASE_START,
    DOCKER_STATUS_TIMEOUT,
    DATABASE_COMMAND_TIMEOUT,
} from '#tests/config/tools/checks/supabase/database.ts';

// The database test needs a Docker daemon with Linux containers. In CI it runs only in the database workflow, started by
// hand, which sets GSPOT_SUPABASE_TEST, because pulling the Postgres image on every run hits the registry rate limit.
const runsDatabase = hasLinuxDocker() && (!isCI || environmentVariables()['GSPOT_SUPABASE_TEST'] === '1');

test.skipIf(!runsDatabase)(
    'native Supabase freshness rejects drift and accepts regenerated database types',
    async () => {
        await using sandbox = await testdir();
        await using database = await prepareSupabaseDatabase(sandbox.path);
        const { options, configPath, authored } = database;
        const stale = await executeRun(
            await openSession(sandbox.path),
            buildRunOptions({ stage: 'push', only: ['supabase/types-fresh'], isDryRun: true }),
        );
        expect(stale.report.exitCode, JSON.stringify(stale.report)).toBe(1);
        expect(stale.report.checks).toMatchObject([
            {
                check: 'supabase/types-fresh',
                status: 'failed',
                findings: [{ file: 'database.ts', rule: 'stale', line: 1 }],
            },
        ]);
        expect(readFileSync(join(sandbox.path, 'database.ts'), 'utf8')).toBe('export type Database = {};\n');
        const generated = await runTestCommand(['supabase', 'gen', 'types', 'typescript', '--local'], options);
        expect(generated.code, generated.stderr).toBe(0);
        expect(generated.stdout).toContain('export type Database');
        await Bun.write(join(sandbox.path, 'database.ts'), generated.stdout);
        const corrected = await executeRun(
            await openSession(sandbox.path),
            buildRunOptions({ stage: 'push', only: ['supabase/types-fresh'], isDryRun: true }),
        );
        expect(corrected.report.exitCode, JSON.stringify(corrected.report)).toBe(0);
        expect(corrected.report.checks).toMatchObject([{ status: 'passed', findings: [] }]);
        expect(readFileSync(configPath)).toStrictEqual(authored);
    },
);

test.skipIf(!runsDatabase)(
    'native Supabase freshness isolates two scoped databases and preserves their configuration',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'apps/api': {}, 'apps/web': {}, 'gspot.toml': NESTED_POLICY });
        await using api = await prepareSupabaseDatabase(join(sandbox.path, 'apps/api'), API_MIGRATIONS);
        await using web = await prepareSupabaseDatabase(join(sandbox.path, 'apps/web'), WEB_MIGRATIONS);
        const options = buildRunOptions({ stage: 'push', only: ['supabase/types-fresh'], isDryRun: true });
        const stale = await executeRun(await openSession(sandbox.path), options);
        expect(stale.report.checks.map((check) => [check.scope, check.status])).toStrictEqual([
            ['apps/api', 'failed'],
            ['apps/web', 'failed'],
        ]);
        const generatedApi = await runTestCommand(['supabase', 'gen', 'types', 'typescript', '--local'], api.options);
        expect(generatedApi.code, generatedApi.stderr).toBe(0);
        expect(generatedApi.stdout).toContain('api_records');
        expect(generatedApi.stdout).not.toContain('web_records');
        await Bun.write(join(sandbox.path, 'apps/api/database.ts'), generatedApi.stdout);
        const partial = await executeRun(await openSession(sandbox.path), options);
        expect(partial.report.checks.map((check) => [check.scope, check.status])).toStrictEqual([
            ['apps/api', 'passed'],
            ['apps/web', 'failed'],
        ]);
        const generatedWeb = await runTestCommand(['supabase', 'gen', 'types', 'typescript', '--local'], web.options);
        expect(generatedWeb.code, generatedWeb.stderr).toBe(0);
        expect(generatedWeb.stdout).toContain('web_records');
        expect(generatedWeb.stdout).not.toContain('api_records');
        await Bun.write(join(sandbox.path, 'apps/web/database.ts'), generatedWeb.stdout);
        const corrected = await executeRun(await openSession(sandbox.path), options);
        expect(corrected.report.exitCode, JSON.stringify(corrected.report)).toBe(0);
        expect(corrected.report.checks.map((check) => [check.scope, check.status])).toStrictEqual([
            ['apps/api', 'passed'],
            ['apps/web', 'passed'],
        ]);
        expect(readFileSync(api.configPath)).toStrictEqual(api.authored);
        expect(readFileSync(web.configPath)).toStrictEqual(web.authored);
    },
);

async function configureDatabaseProject(root: string, project: string): Promise<SupabaseProjectFiles> {
    const configPath = join(root, 'supabase/config.toml');
    const config = parse(readFileSync(configPath, 'utf8'));
    config['project_id'] = project;
    const listener = createServer();
    await new Promise<void>((complete) => listener.listen(0, '127.0.0.1', complete));
    const address = listener.address();
    if (address === null || typeof address === 'string') throw new Error('No isolated database port was allocated.');
    const db = config['db'];
    if (!isRecord(db)) throw new Error('Supabase init did not declare database settings.');
    db['port'] = address.port;
    await new Promise<void>((complete, reject) =>
        listener.close((error) => {
            if (error) reject(error);
            else complete();
        }),
    );
    await Bun.write(configPath, stringify(config));
    await createFileTree(root, {
        'gspot.toml': buildPolicy(['supabase'], { tables: '[supabase]\ntypes_file = "database.ts"\n' }),
        'database.ts': 'export type Database = {};\n',
    });
    return { configPath, authored: readFileSync(configPath) };
}

/** Starts an isolated native database and retains the authored configuration for preservation checks. */
async function prepareSupabaseDatabase(
    root: string,
    migrations: Record<string, string> = {},
): Promise<SupabaseDatabase> {
    const project = `gspot-types-${randomUUID().replaceAll('-', '').slice(0, 28)}`;
    const options = { cwd: root, timeoutMs: DATABASE_COMMAND_TIMEOUT };
    const version = await runTestCommand(['supabase', '--version'], options);
    if (version.code !== 0) throw new Error(`Supabase fixture version failed: ${version.stderr}`);
    for (const { args, timeoutMs } of [
        { args: ['docker', 'info', '--format', '{{.ServerVersion}}'], timeoutMs: DOCKER_STATUS_TIMEOUT },
        { args: ['supabase', 'init'], timeoutMs: options.timeoutMs },
    ]) {
        const initialized = await runTestCommand(args, { ...options, timeoutMs });
        if (initialized.code !== 0) throw new Error(`Supabase fixture ${args.join(' ')} failed: ${initialized.stderr}`);
    }
    const { configPath, authored } = await configureDatabaseProject(root, project);
    await createFileTree(
        root,
        Object.fromEntries(Object.entries(migrations).map(([name, sql]) => [`supabase/migrations/${name}`, sql])),
    );
    const dispose = async () => {
        const stopped = await runTestCommand(['supabase', 'stop', '--project-id', project, '--no-backup'], options);
        if (stopped.code !== 0) throw new Error(`Supabase database cleanup failed: ${stopped.stderr}`);
    };
    await using cleanup = new AsyncDisposableStack();
    cleanup.defer(dispose);
    const started = await runTestCommand(DATABASE_START, options);
    if (started.code !== 0) throw new Error(`Supabase database fixture failed: ${started.stdout}${started.stderr}`);
    const resources = cleanup.move();
    return {
        options,
        configPath,
        authored,
        version: version.stdout.trim(),
        async [Symbol.asyncDispose]() {
            await resources.disposeAsync();
        },
    };
}
