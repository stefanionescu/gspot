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
import { run as runCli } from '#tests/support/cli/command.ts';
import { chmodSync, existsSync, mkdirSync, readFileSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { rejection } from '#tests/support/rejection.ts';

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

for (const scope of ['', 'packages/db']) {
    for (const isFailure of [false, true]) {
        test(`migration generation in ${scope || 'root'} preserves tracked and untracked files after ${isFailure ? 'failure' : 'success'}`, async () => {
            await using directory = await testdir();
            const path = (file: string) => join(scope, file);
            await createFileTree(directory.path, {
                'gspot.toml':
                    'version = 1\nconfigurations = ["drizzle"]\n' +
                    (scope === '' ? '' : `[[scope]]\npath = "${scope}"\nconfigurations = []\n`),
                [path('package.json')]: '{"private":true}\n',
                [path('drizzle.config.ts')]: 'export default {};\n',
                [path('schema.txt')]: isFailure ? 'failure' : 'changed',
                [path('generate')]: GENERATOR,
                [path('migrations/0000_initial.sql')]: 'CREATE TABLE records (id int);\n',
                [path('migrations/meta/journal.json')]: '{"version":1}\n',
                'unrelated/keep.sql': '-- Keep another scope\n',
            });
            commitAll(directory.path);
            const manual = join(directory.path, path('migrations/0009_manual.sql'));
            writeFileSync(manual, '-- Preserve manual migration\n');
            chmodSync(manual, 0o640);
            const mode = statSync(manual).mode;
            const initial = join(directory.path, path('migrations/0000_initial.sql'));
            writeFileSync(initial, '-- Developer edit\n');
            const bin = join(directory.path, 'node_modules/.bin');
            mkdirSync(bin, { recursive: true });
            symlinkSync(
                process.execPath,
                join(bin, process.platform === 'win32' ? 'drizzle-kit.exe' : 'drizzle-kit'),
                'file',
            );
            const session = await openSession(directory.path);
            const spec = session.manifests
                .get('drizzle')!
                .checks.find((entry) => entry.analysis === 'drizzle-migrations')!;
            const planned = await planRun(session, { stage: 'push', skips: [], only: [spec.name] });
            const input = engineInput(session, planned.find((entry) => entry.scope.scope.path === scope)!);
            const locate = spyOn(Bun, 'which').mockReturnValue(process.execPath);
            try {
                if (isFailure) {
                    expect((await rejection(drizzleMigrations(input))).message).toContain(
                        'Migration generation failed',
                    );
                    writeFileSync(join(directory.path, path('schema.txt')), 'current');
                    expect(await drizzleMigrations(input)).toStrictEqual([]);
                } else {
                    const found = await drizzleMigrations(input);
                    expect(found.map(({ check, file, rule }) => ({ check, file, rule }))).toStrictEqual([
                        {
                            check: spec.name,
                            file: path('migrations/0001_change.sql').replaceAll('\\', '/'),
                            rule: 'missing-migration',
                        },
                        {
                            check: spec.name,
                            file: path('migrations/meta/journal.json').replaceAll('\\', '/'),
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
                    if (scope === '') {
                        const checked = await runCli(directory.path, [
                            'check',
                            '--stage',
                            'push',
                            '--only',
                            spec.name,
                            '--no-cache',
                            '--json',
                        ]);
                        expect(checked.code, checked.stdout + checked.stderr).toBe(1);
                        const report = reportSchema.parse(JSON.parse(checked.stdout));
                        expect(report.checks.map(({ check, status }) => ({ check, status }))).toStrictEqual([
                            { check: spec.name, status: 'fail' },
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
                        ).toStrictEqual(
                            found.map(({ check, file, line, rule, message }) => ({ check, file, line, rule, message })),
                        );
                    }
                    writeFileSync(join(directory.path, path('schema.txt')), 'current');
                    expect(await drizzleMigrations(input)).toStrictEqual([]);
                    if (scope === '') {
                        const checked = await runCli(directory.path, [
                            'check',
                            '--stage',
                            'push',
                            '--only',
                            spec.name,
                            '--no-cache',
                            '--json',
                        ]);
                        expect(checked.code, checked.stdout + checked.stderr).toBe(0);
                        const report = reportSchema.parse(JSON.parse(checked.stdout));
                        expect(report.checks.map(({ check, status }) => ({ check, status }))).toStrictEqual([
                            { check: spec.name, status: 'ok' },
                        ]);
                        expect(report.skips).toStrictEqual([]);
                        expect(report.checks[0]!.findings).toStrictEqual([]);
                    }
                }
                expect(readFileSync(manual, 'utf8')).toBe('-- Preserve manual migration\n');
                expect(statSync(manual).mode).toBe(mode);
                expect(readFileSync(initial, 'utf8')).toBe('-- Developer edit\n');
                expect(readFileSync(join(directory.path, path('migrations/meta/journal.json')), 'utf8')).toBe(
                    '{"version":1}\n',
                );
                expect(readFileSync(join(directory.path, 'unrelated/keep.sql'), 'utf8')).toBe(
                    '-- Keep another scope\n',
                );
            } finally {
                locate.mockRestore();
            }
        });
    }
}

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
                (
                    await rejection(
                        drizzleMigrations({
                            ...input,
                            ...(failure === 'cancellation' ? { cancelSignal: AbortSignal.timeout(100) } : {}),
                        }),
                    )
                ).message,
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
