import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { test, expect } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { parse, stringify } from 'smol-toml';
import { run } from '#cli/platform/spawn.ts';
import { CHECKS } from '#cli/checks/registry.ts';
import { tableAt } from '#cli/policy/mutations.ts';
import { testdir, createFileTree } from 'testdirs';
import { executeRun } from '#cli/execution/execute.ts';
import { openSession } from '#cli/execution/session.ts';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { hasLinuxDocker } from '#tests/harness/cli/platforms.ts';
import { isCi, environmentVariables } from '#cli/platform/environment.ts';
import type { PrepareSupabaseDatabaseResult } from '#tests/types/results.ts';

const DATABASE_START = [
    'supabase',
    'start',
    '--exclude',
    'gotrue,realtime,storage-api,imgproxy,kong,mailpit,postgrest,postgres-meta,studio,edge-runtime,logflare,vector,supavisor',
];

/** Starts an isolated native database and retains the authored configuration for preservation checks. */
async function prepareSupabaseDatabase(root: string): Promise<PrepareSupabaseDatabaseResult> {
    const project = `gspot-types-${randomUUID().replaceAll('-', '').slice(0, 28)}`;
    const options = { cwd: root, timeoutMs: 180_000 };
    const version = await run(['supabase', '--version'], options);
    if (version.code !== 0) throw new Error(`Supabase fixture version failed: ${version.stderr}`);
    for (const { args, timeoutMs } of [
        { args: ['docker', 'info', '--format', '{{.ServerVersion}}'], timeoutMs: 10_000 },
        { args: ['supabase', 'init'], timeoutMs: options.timeoutMs },
    ]) {
        const initialized = await run(args, { ...options, timeoutMs });
        if (initialized.code !== 0) throw new Error(`Supabase fixture ${args.join(' ')} failed: ${initialized.stderr}`);
    }
    const configPath = join(root, 'supabase/config.toml');
    const config = parse(readFileSync(configPath, 'utf8'));
    config['project_id'] = project;
    const listener = createServer();
    await new Promise<void>((complete) => listener.listen(0, '127.0.0.1', complete));
    const address = listener.address();
    if (address === null || typeof address === 'string') throw new Error('No isolated database port was allocated.');
    const db = tableAt(config, ['db'], false);
    if (db === undefined) throw new Error('Supabase init did not declare database settings.');
    db['port'] = address.port;
    await new Promise<void>((complete, reject) =>
        listener.close((error) => {
            if (error) reject(error);
            else complete();
        }),
    );
    await Bun.write(configPath, stringify(config));
    await createFileTree(root, {
        'gspot.toml': policyOf(['supabase'], '[tools.supabase]\ntypes_file = "database.ts"\n'),
        'database.ts': 'export type Database = {};\n',
    });
    const authored = readFileSync(configPath);
    const dispose = async () => {
        const stopped = await run(['supabase', 'stop', '--project-id', project, '--no-backup'], options);
        if (stopped.code !== 0) throw new Error(`Supabase database cleanup failed: ${stopped.stderr}`);
    };
    await using cleanup = new AsyncDisposableStack();
    cleanup.defer(dispose);
    const started = await run(DATABASE_START, options);
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

// The database journey needs a Docker daemon with Linux containers. In CI it runs only in the weekly database workflow,
// which sets DATABASE_JOURNEYS, because pulling the Postgres image on every run hits the registry rate limit.
const runsDatabase = hasLinuxDocker && (!isCi() || environmentVariables()['DATABASE_JOURNEYS'] === '1');

if (runsDatabase)
    test('native Supabase freshness rejects drift and accepts regenerated database types', async () => {
        await using sandbox = await testdir();
        await using database = await prepareSupabaseDatabase(sandbox.path);
        const { options, configPath, authored } = database;
        const stale = await executeRun(await openSession(sandbox.path), {
            checks: CHECKS,
            stage: 'push',
            only: ['supabase/types-fresh'],
            skips: [],
            fix: false,
            isDryRun: true,
        });
        expect(stale.report.exitCode, JSON.stringify(stale.report)).toBe(1);
        expect(stale.report.checks).toMatchObject([
            {
                check: 'supabase/types-fresh',
                status: 'fail',
                findings: [{ file: 'database.ts', rule: 'types', line: 1 }],
            },
        ]);
        expect(readFileSync(join(sandbox.path, 'database.ts'), 'utf8')).toBe('export type Database = {};\n');
        const generated = await run(['supabase', 'gen', 'types', 'typescript', '--local'], options);
        expect(generated.code, generated.stderr).toBe(0);
        expect(generated.stdout).toContain('export type Database');
        await Bun.write(join(sandbox.path, 'database.ts'), generated.stdout);
        const corrected = await executeRun(await openSession(sandbox.path), {
            checks: CHECKS,
            stage: 'push',
            only: ['supabase/types-fresh'],
            skips: [],
            fix: false,
            isDryRun: true,
        });
        expect(corrected.report.exitCode, JSON.stringify(corrected.report)).toBe(0);
        expect(corrected.report.checks).toMatchObject([{ status: 'ok', findings: [] }]);
        expect(readFileSync(configPath)).toStrictEqual(authored);
    }, 600_000);
