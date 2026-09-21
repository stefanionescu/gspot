import { join } from 'node:path';
import { chmodSync, mkdirSync, readFileSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { expect, spyOn, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { commitAll, run as runCli } from '../../../../tests/harness/planted.ts';
import { reportSchema } from '#cli/run/report-schema.ts';
import { openSession } from '#cli/run/session.ts';
import { drizzleMigrations } from '#cli/checks/libraries.ts';

const GENERATOR = `import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const schema = readFileSync('schema.txt', 'utf8');
if (schema !== 'current') {
    mkdirSync('migrations/meta', { recursive: true });
    writeFileSync('migrations/0001_change.sql', 'ALTER TABLE records ADD name text;\\n');
    writeFileSync('migrations/meta/journal.json', '{"version":2}\\n');
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
                'gspot.toml': 'version = 1\npresets = ["drizzle"]\n',
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
            const selection = session.scopes.find((entry) => entry.scope.path === scope) ?? session.scopes[0]!;
            const input = {
                root: directory.path,
                scope,
                session,
                spec,
                view: selection.view,
                files: session.repository.files,
            };
            const locate = spyOn(Bun, 'which').mockReturnValue(process.execPath);
            try {
                if (isFailure) await expect(drizzleMigrations(input)).rejects.toThrow('Migration generation failed');
                else {
                    const found = await drizzleMigrations(input);
                    expect(found.map(({ check, file, rule }) => ({ check, file, rule }))).toEqual([
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
                        expect(report.checks.map(({ check, status }) => ({ check, status }))).toEqual([
                            { check: spec.name, status: 'fail' },
                        ]);
                        expect(report.skips).toEqual([]);
                        expect(
                            report.checks[0]!.findings.map(({ check, file, line, rule, message }) => ({
                                check,
                                file,
                                line,
                                rule,
                                message,
                            })),
                        ).toEqual(
                            found.map(({ check, file, line, rule, message }) => ({ check, file, line, rule, message })),
                        );
                    }
                    writeFileSync(join(directory.path, path('schema.txt')), 'current');
                    expect(await drizzleMigrations(input)).toEqual([]);
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
                        expect(report.checks.map(({ check, status }) => ({ check, status }))).toEqual([
                            { check: spec.name, status: 'ok' },
                        ]);
                        expect(report.skips).toEqual([]);
                        expect(report.checks[0]!.findings).toEqual([]);
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
