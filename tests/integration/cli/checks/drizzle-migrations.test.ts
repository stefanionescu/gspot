import { join } from 'node:path';
import { expect, spyOn, test } from 'bun:test';
import { planRun } from '#cli/execution/plan.ts';
import { createFileTree, testdir } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { commitAll } from '#tests/support/cli/git.ts';
import { engineInput } from '#cli/execution/engines.ts';
import { openSession } from '#cli/execution/session.ts';
import { reportSchema } from '#cli/execution/report.ts';
import { drizzleMigrations } from '#cli/checks/drizzle.ts';
import { rejection } from '#tests/support/expectations.ts';
import { run as runCli } from '#tests/support/cli/command.ts';
import { chmodSync, existsSync, mkdirSync, readFileSync, statSync, symlinkSync, writeFileSync } from 'node:fs';

const GENERATOR = String.raw`import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const schema = readFileSync('schema.txt', 'utf8');
if (schema !== 'current') {
    mkdirSync('migrations/meta', { recursive: true });
    writeFileSync('migrations/0001_change.sql', 'ALTER TABLE records ADD name text;\n');
    writeFileSync('migrations/meta/journal.json', '{"version":2}\n');
}

if (schema === 'failure') {
    console.error('Migration generation failed');
    process.exitCode = 1;
}
`;

const SCOPES = ['', 'packages/db'];

// A planted scope with a generator script that stands in for drizzle-kit: `schema.txt` decides what it does.
async function plant(scope: string, schema: 'changed' | 'failure') {
    const directory = await testdir();
    const path = (file: string) => join(scope, file);
    await createFileTree(directory.path, {
        'gspot.toml':
            'version = 1\nconfigurations = ["drizzle"]\n' +
            (scope === '' ? '' : `[[scope]]\npath = "${scope}"\nconfigurations = []\n`),
        [path('package.json')]: '{"private":true}\n',
        [path('drizzle.config.ts')]: 'export default {};\n',
        [path('schema.txt')]: schema,
        [path('generate')]: GENERATOR,
        [path('migrations/0000_initial.sql')]: 'CREATE TABLE records (id int);\n',
        [path('migrations/meta/journal.json')]: '{"version":1}\n',
        'unrelated/keep.sql': '-- Keep another scope\n',
    });
    commitAll(directory.path);
    const manual = join(directory.path, path('migrations/0009_manual.sql'));
    writeFileSync(manual, '-- Preserve manual migration\n');
    chmodSync(manual, 0o640);
    const initial = join(directory.path, path('migrations/0000_initial.sql'));
    writeFileSync(initial, '-- Developer edit\n');
    const bin = join(directory.path, 'node_modules/.bin');
    mkdirSync(bin, { recursive: true });
    symlinkSync(process.execPath, join(bin, process.platform === 'win32' ? 'drizzle-kit.exe' : 'drizzle-kit'), 'file');
    const session = await openSession(directory.path);
    const spec = session.manifests.get('drizzle')!.checks.find((entry) => entry.analysis === 'drizzle-migrations')!;
    const planned = await planRun(session, { stage: 'push', skips: [], only: [spec.name] });
    const input = engineInput(session, planned.find((entry) => entry.scope.scope.path === scope)!);
    return { directory, path, manual, mode: statSync(manual).mode, initial, spec, input };
}

type Planted = Awaited<ReturnType<typeof plant>>;

// Whatever the generator did, the tracked edits, the untracked migration, and the other scope are untouched.
function expectPreserved({ directory, path, manual, mode, initial }: Planted): void {
    expect(readFileSync(manual, 'utf8')).toBe('-- Preserve manual migration\n');
    expect(statSync(manual).mode).toBe(mode);
    expect(readFileSync(initial, 'utf8')).toBe('-- Developer edit\n');
    expect(readFileSync(join(directory.path, path('migrations/meta/journal.json')), 'utf8')).toBe('{"version":1}\n');
    expect(readFileSync(join(directory.path, 'unrelated/keep.sql'), 'utf8')).toBe('-- Keep another scope\n');
}

test.each(SCOPES)('a failed generation in %s reports the failure and preserves every file', async (scope) => {
    const planted = await plant(scope, 'failure');
    await using directory = planted.directory;
    const locate = spyOn(Bun, 'which').mockReturnValue(process.execPath);
    try {
        expect(await rejection(drizzleMigrations(planted.input))).toContain('Migration generation failed');
        writeFileSync(join(directory.path, planted.path('schema.txt')), 'current');
        expect(await drizzleMigrations(planted.input)).toStrictEqual([]);
        expectPreserved(planted);
    } finally {
        locate.mockRestore();
    }
});

test.each(SCOPES)(
    'a stale schema in %s reports the missing migration files and preserves every file',
    async (scope) => {
        const planted = await plant(scope, 'changed');
        await using directory = planted.directory;
        const locate = spyOn(Bun, 'which').mockReturnValue(process.execPath);
        try {
            const found = await drizzleMigrations(planted.input);
            expect(found.map(({ check, file, rule }) => ({ check, file, rule }))).toStrictEqual([
                {
                    check: planted.spec.name,
                    file: planted.path('migrations/0001_change.sql').replaceAll('\\', '/'),
                    rule: 'missing-migration',
                },
                {
                    check: planted.spec.name,
                    file: planted.path('migrations/meta/journal.json').replaceAll('\\', '/'),
                    rule: 'missing-migration',
                },
            ]);
            expect(
                found.every(
                    (entry) =>
                        entry.message ===
                        'drizzle-kit changes this file when generating migrations; regenerate and commit the migration output.',
                ),
            ).toBe(true);
            writeFileSync(join(directory.path, planted.path('schema.txt')), 'current');
            expect(await drizzleMigrations(planted.input)).toStrictEqual([]);
            expectPreserved(planted);
        } finally {
            locate.mockRestore();
        }
    },
);

test('the check command reports the missing migrations of the root and their correction', async () => {
    const planted = await plant('', 'changed');
    await using directory = planted.directory;
    const locate = spyOn(Bun, 'which').mockReturnValue(process.execPath);
    const args = ['check', '--stage', 'push', '--only', planted.spec.name, '--no-cache', '--json'];
    try {
        const found = await drizzleMigrations(planted.input);
        const checked = await runCli(directory.path, args);
        expect(checked.code, checked.stdout + checked.stderr).toBe(1);
        const report = reportSchema.parse(JSON.parse(checked.stdout));
        expect(report.checks.map(({ check, status }) => ({ check, status }))).toStrictEqual([
            { check: planted.spec.name, status: 'fail' },
        ]);
        expect(report.skips).toStrictEqual([]);
        expect(
            report.checks[0]!.findings.map(({ check, file, line, rule, message }) => ({
                check,
                file,
                line,
                rule,
                message,
            })),
        ).toStrictEqual(found.map(({ check, file, line, rule, message }) => ({ check, file, line, rule, message })));
        writeFileSync(join(directory.path, 'schema.txt'), 'current');
        const corrected = await runCli(directory.path, args);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        const clean = reportSchema.parse(JSON.parse(corrected.stdout));
        expect(clean.checks.map(({ check, status }) => ({ check, status }))).toStrictEqual([
            { check: planted.spec.name, status: 'ok' },
        ]);
        expect(clean.skips).toStrictEqual([]);
        expect(clean.checks[0]!.findings).toStrictEqual([]);
    } finally {
        locate.mockRestore();
    }
});

test.each(['cancellation', 'deadline'])(
    'migration generation honors %s, removes its copy, and accepts a corrected generator',
    async (failure) => {
        await using directory = await testdir();
        await createFileTree(directory.path, {
            'gspot.toml': 'version = 1\nconfigurations = ["drizzle"]\n[limits]\ntool_seconds = 1\n',
            'drizzle.config.ts': 'export default {};\n',
            generate: 'setInterval(() => {}, 1000);\n',
        });
        const session = await openSession(directory.path);
        const [planned] = await planRun(session, {
            stage: 'push',
            skips: [],
            only: ['drizzle/migrations-fresh'],
        });
        const input = engineInput(session, planned!);
        const copies: string[] = [];
        const execute = processes.run;
        const spawn = spyOn(processes, 'run').mockImplementation((command, options) => {
            if (command[1] === 'generate') copies.push(options.cwd);
            return execute(command, options);
        });
        const locate = spyOn(Bun, 'which').mockReturnValue(process.execPath);
        try {
            expect(
                await rejection(
                    drizzleMigrations({
                        ...input,
                        ...(failure === 'cancellation' ? { cancelSignal: AbortSignal.timeout(100) } : {}),
                    }),
                ),
            ).toContain(failure === 'cancellation' ? 'canceled' : 'was stopped');
            expect(copies).toHaveLength(1);
            expect(copies.every((path) => !existsSync(path))).toBe(true);
            expect(readFileSync(join(directory.path, 'generate'), 'utf8')).toBe('setInterval(() => {}, 1000);\n');
            await Bun.write(join(directory.path, 'generate'), 'process.exitCode = 0;\n');
            expect(await drizzleMigrations(input)).toStrictEqual([]);
            expect(copies).toHaveLength(2);
            expect(copies.every((path) => !existsSync(path))).toBe(true);
        } finally {
            spawn.mockRestore();
            locate.mockRestore();
        }
    },
);
