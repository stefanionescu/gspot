import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { parse, stringify } from 'smol-toml';
import { run } from '#cli/platform/spawn.ts';
import { createFileTree, testdir } from 'testdirs';
import { executeRun } from '#cli/execution/execute.ts';
import { openSession } from '#cli/execution/session.ts';

// This compatibility fixture uses the installed CLI release and its database image selection.
const CLI_VERSION = '2.72.7';

test('Supabase CLI 2.72.7 generates local database types and production freshness rejects drift', async () => {
    await using sandbox = await testdir();
    const project = `gspot-types-${randomUUID()}`;
    const options = { cwd: sandbox.path, timeoutMs: 180_000 };
    const version = await run(['supabase', '--version'], options);
    expect(version.code, version.stderr).toBe(0);
    expect(version.stdout.trim()).toBe(CLI_VERSION);
    const docker = await run(['docker', 'info', '--format', '{{.ServerVersion}}'], { ...options, timeoutMs: 10_000 });
    expect(docker.code, docker.stderr).toBe(0);
    const initialized = await run(['supabase', 'init'], options);
    expect(initialized.code, initialized.stderr).toBe(0);
    const configPath = join(sandbox.path, 'supabase/config.toml');
    const config = parse(readFileSync(configPath, 'utf8'));
    config['project_id'] = project;
    const listener = createServer();
    await new Promise<void>((resolve) => listener.listen(0, '127.0.0.1', resolve));
    const address = listener.address();
    if (address === null || typeof address === 'string') throw new Error('No isolated database port was allocated.');
    const db = config['db'];
    if (typeof db !== 'object' || Array.isArray(db) || db instanceof Date)
        throw new Error('Supabase init did not declare database settings.');
    db['port'] = address.port;
    await new Promise<void>((resolve, reject) =>
        listener.close((error) => {
            if (error) reject(error);
            else resolve();
        }),
    );
    await Bun.write(configPath, stringify(config));
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nconfigurations = ["supabase"]\n[tools.supabase]\ntypes_file = "database.ts"\n',
        'database.ts': 'export type Database = {};\n',
    });
    const authored = readFileSync(configPath);
    try {
        const started = await run(
            [
                'supabase',
                'start',
                '--exclude',
                'gotrue,realtime,storage-api,imgproxy,kong,mailpit,postgrest,postgres-meta,studio,edge-runtime,logflare,vector,supavisor',
            ],
            options,
        );
        expect(started.code, started.stdout + started.stderr).toBe(0);
        const check = async () =>
            await executeRun(await openSession(sandbox.path), {
                stage: 'push',
                only: ['supabase/types-fresh'],
                skips: [],
                fix: false,
                isDryRun: true,
                noCache: true,
            });
        const stale = await check();
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
        const corrected = await check();
        expect(corrected.report.exitCode, JSON.stringify(corrected.report)).toBe(0);
        expect(corrected.report.checks).toMatchObject([{ status: 'ok', findings: [] }]);
        expect(readFileSync(configPath)).toStrictEqual(authored);
    } finally {
        const stopped = await run(['supabase', 'stop', '--project-id', project, '--no-backup'], options);
        expect(stopped.code, stopped.stderr).toBe(0);
    }
}, 600_000);
