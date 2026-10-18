import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { rename, writeFile } from 'node:fs/promises';
import { checkFindings } from '#tests/setup/check-input.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { runGspot, checkReport } from '#tests/setup/run-gspot.ts';
import { NUMBERED_PREFIX_OVERRIDE } from '#tests/data/checks/naming/settings.ts';
import { NUMBERED_FILES, MIGRATION_FILES } from '#tests/data/checks/naming/sources.ts';

test('[slug] path brackets are allowed in every scope and banned file names are reported', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSettingsText(['javascript', 'typescript', 'naming'], {
            level: 'all',
            tables: '[[scope]]\npath = "app"\nconfigurations = ["nextjs"]\n',
        }),
        'handler.ts': 'export const port = 1;\n',
        '(group)/[id]/@slot/_private/page.ts': 'export function handleSubmit() {}\n',
        'app/(group)/[id]/@slot/_private/page.ts': 'export function handleSubmit() {}\n',
        'app/[...slug].ts': 'export function handleClick() {}\n',
    });
    const result = await checkReport(sandbox.path, ['check', '--only', 'naming/paths', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(1);
    const findings = result.report.checks.flatMap(({ findings }) => findings);
    expect(findings.map(({ file }) => file)).toStrictEqual(['handler.ts']);
    expect(findings.filter(({ file }) => file.startsWith('app/'))).toStrictEqual([]);
});

test('__init__.ts is reported; Python __init__.py and __main__.py are allowed', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSettingsText(['python', 'typescript', 'naming'], { level: 'all' }),
        'python/__init__.py': '"""Package entry."""\n',
        'python/__main__.py': '"""Program entry."""\n',
        'javascript/__init__.ts': 'export const entry = 1;\n',
    });
    const command = ['check', '--only', 'naming/paths', '--json'];
    const failed = await checkReport(sandbox.path, command);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect(failed.report.checks.flatMap(({ findings }) => findings)).toMatchObject([
        { file: 'javascript/__init__.ts', line: 1, column: 1, rule: 'case' },
    ]);
    await rename(join(sandbox.path, 'javascript/__init__.ts'), join(sandbox.path, 'javascript/entry.ts'));
    const corrected = await checkReport(sandbox.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(corrected.report.checks).toMatchObject([{ status: 'passed', findings: [] }]);
});

test.each(['', 'app'])(
    'a migration folder name with digits needs the postgres configuration (scope "%s")',
    async (scope) => {
        await using sandbox = await testdir();
        const prefix = scope === '' ? '' : `${scope}/`;
        for (const [path, text] of Object.entries(MIGRATION_FILES))
            await createFileTree(sandbox.path, { [`${prefix}${path}`]: text });
        const settings = buildSettingsText(['naming', 'sql'], { level: 'all', tables: '[[scope]]\npath = "app"\n' });
        await writeFile(join(sandbox.path, 'gspot.toml'), settings);

        const refused = await checkFindings(sandbox.path, 'naming/paths', { scope });
        expect(refused.filter(({ rule }) => rule === 'digits').map(({ file }) => file)).toStrictEqual(
            Object.keys(MIGRATION_FILES).map((path) => `${prefix}${path}`),
        );
        await writeFile(
            join(sandbox.path, 'gspot.toml'),
            buildSettingsText(['naming', 'postgres'], { level: 'all', tables: '[[scope]]\npath = "app"\n' }),
        );

        const allowed = await checkFindings(sandbox.path, 'naming/paths', { scope });
        expect(allowed.filter(({ rule }) => rule === 'digits').map(({ file }) => file)).toStrictEqual([
            `${prefix}other/20240101000000_create_teams/query.sql`,
        ]);
    },
);

test('a SQL migration file name keeps its timestamp and must be snake case', async () => {
    await using sandbox = await testdir();
    const invalid = 'migrations/20260101120000_CreateUsers.sql';
    const valid = 'migrations/20260101120000_create_users.sql';
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSettingsText(['sql', 'naming'], { level: 'all' }),
        [invalid]: 'CREATE TABLE users (id integer);\n',
        'queries/select_users.sql': 'SELECT id FROM users;\n',
    });
    const command = ['check', '--only', 'naming/paths', '--json'];
    const refused = await checkReport(sandbox.path, command);
    expect(refused.code, refused.stdout + refused.stderr).toBe(1);
    const report = refused.report;
    expect(report.checks.flatMap((check) => check.findings)).toMatchObject([
        { file: invalid, line: 1, column: 1, rule: 'case' },
    ]);
    await rename(join(sandbox.path, invalid), join(sandbox.path, valid));
    const accepted = await checkReport(sandbox.path, command);
    expect(accepted.code, accepted.stdout + accepted.stderr).toBe(0);
    expect(accepted.report.checks).toMatchObject([{ check: 'naming/paths', status: 'passed', findings: [] }]);
});

test('Next.js special pages such as _app and 404 are allowed; a snake_case page is reported', async () => {
    await using sandbox = await testdir();
    const source = 'export default function Page() { return null; }\n';
    const pages = ['_app', '_document', '_error', '404', '500'].map((name) => `pages/${name}.tsx`);
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSettingsText(['nextjs', 'naming'], { level: 'all' }),
        ...Object.fromEntries(pages.map((path) => [path, source])),
        'pages/about_page.ts': 'export const title = "About";\n',
    });
    const command = ['check', '--only', 'naming/paths', '--json'];
    const failed = await checkReport(sandbox.path, command);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect(failed.report.checks.flatMap((check) => check.findings)).toMatchObject([
        { file: 'pages/about_page.ts', rule: 'case' },
    ]);
    await rename(join(sandbox.path, 'pages/about_page.ts'), join(sandbox.path, 'pages/about-page.ts'));
    const corrected = await runGspot(sandbox.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
});

test('files in dot folders still get file-name checks', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSettingsText(['typescript', 'naming'], { level: 'all' }),
        '.archive/bad_name.ts': 'export const entry = 1;\n',
        '.claude/entry.ts': 'export const entry = 1;\n',
        '.vscode/entry.ts': 'export const entry = 1;\n',
    });
    const command = ['check', '--only', 'naming/paths', '--json'];
    const failed = await checkReport(sandbox.path, command);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect(failed.report.checks.flatMap(({ findings }) => findings)).toMatchObject([
        { file: '.archive/bad_name.ts', line: 1, column: 1, rule: 'case' },
    ]);
    await rename(join(sandbox.path, '.archive/bad_name.ts'), join(sandbox.path, '.archive/bad-name.ts'));
    const corrected = await checkReport(sandbox.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(corrected.report.checks).toMatchObject([{ status: 'passed', findings: [] }]);
});

test('a numbered file name needs an ignored_prefix override', async () => {
    await using sandbox = await testdir();
    const settings = buildSettingsText(['bash', 'naming'], { level: 'all' });
    await createFileTree(sandbox.path, { 'gspot.toml': settings, ...NUMBERED_FILES });
    const command = ['check', '--only', 'naming/paths', '--json'];
    const failed = await checkReport(sandbox.path, command);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect(
        failed.report.checks.flatMap(({ findings }) => findings.map(({ file, rule }) => ({ file, rule }))),
    ).toStrictEqual([
        { file: '.mise/tasks/01-build.sh', rule: 'case' },
        { file: '.mise/tasks/01-build.sh', rule: 'digits' },
        { file: 'scripts/steps/01-build.sh', rule: 'case' },
        { file: 'scripts/steps/01-build.sh', rule: 'digits' },
    ]);
    await Bun.write(join(sandbox.path, 'gspot.toml'), settings + NUMBERED_PREFIX_OVERRIDE);
    const corrected = await checkReport(sandbox.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(corrected.report.checks).toMatchObject([{ status: 'passed', findings: [] }]);
});

test('a banned folder word such as shared is reported in folder names', async () => {
    await using sandbox = await testdir();
    const paths = ['shared/first.js', 'app/shared/first.js', 'app/worker/shared/entry.js'];
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSettingsText(['javascript', 'naming'], {
            level: 'all',
            tables: '[[scope]]\npath = "app"\n[[scope]]\npath = "app/worker"\n',
        }),
        ...Object.fromEntries(paths.map((path) => [path, 'export const active = true;\n'])),
    });
    const result = await checkReport(sandbox.path, ['check', '--only', 'naming/paths', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(1);
    expect(
        result.report.checks
            .flatMap(({ findings }) => findings.map(({ file }) => file))
            .toSorted((left, right) => left.localeCompare(right)),
    ).toStrictEqual(paths.toSorted((left, right) => left.localeCompare(right)));
});
