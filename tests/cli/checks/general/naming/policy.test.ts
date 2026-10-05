import { join } from 'node:path';
import { renameSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { containing } from '#tests/harness/expectations.ts';
import type { RunReport } from '#cli/types/execution/runtime.ts';
import { SCOPE_POLICY, TEST_PATH_FILES, TEST_PATH_POLICY } from '#tests/config/cli/checks/naming.ts';

const MISMATCHED_POLICY = SCOPE_POLICY.replace('name = "remote_record"', 'name = "remoteRecord"');

test('external property allowances retain adjacent local signature findings through the CLI', async () => {
    await using sandbox = await testdir();
    const source =
        'export type Template = {\n    external_key: string;\n    user_name: string;\n    USER_COUNT: number;\n};\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['typescript', 'naming'], {
            tables: '[[naming.paths]]\npaths = ["source.ts"]\ncategories = ["properties"]\nnames = ["external_key"]\ncase = ["snake"]\nreason = "The remote API fixes this exact property key."\n',
            level: 'all',
        }),
        'source.ts': source,
    });
    const command = ['check', '--json', '--only', 'naming/identifiers'];
    const failed = await runGspot(sandbox.path, command);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    const report = JSON.parse(failed.stdout) as RunReport;
    expect(
        report.checks.flatMap(({ findings }) =>
            findings.map(({ file, line, column, rule }) => ({ file, line, column, rule })),
        ),
    ).toStrictEqual([
        { file: 'source.ts', line: 3, column: 5, rule: 'case' },
        { file: 'source.ts', line: 4, column: 5, rule: 'case' },
    ]);
    await Bun.write(
        join(sandbox.path, 'source.ts'),
        source.replace('user_name', 'userName').replace('USER_COUNT', 'userCount'),
    );
    const corrected = await runGspot(sandbox.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(await Bun.file(join(sandbox.path, 'source.ts')).text()).toContain('external_key: string');
});

test('SQL migration names retain their timestamp while enforcing snake case', async () => {
    await using sandbox = await testdir();
    const invalid = 'migrations/20260101120000_CreateUsers.sql';
    const valid = 'migrations/20260101120000_create_users.sql';
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['sql', 'naming'], { level: 'all' }),
        [invalid]: 'CREATE TABLE users (id integer);\n',
        'queries/select_users.sql': 'SELECT id FROM users;\n',
    });
    const command = ['check', '--only', 'naming/paths', '--json'];
    const refused = await runGspot(sandbox.path, command);
    expect(refused.code, refused.stdout + refused.stderr).toBe(1);
    const report = JSON.parse(refused.stdout) as RunReport;
    expect(report.checks.flatMap((check) => check.findings)).toMatchObject([
        { file: invalid, line: 1, column: 1, rule: 'case' },
    ]);
    renameSync(join(sandbox.path, invalid), join(sandbox.path, valid));
    const accepted = await runGspot(sandbox.path, command);
    expect(accepted.code, accepted.stdout + accepted.stderr).toBe(0);
    expect((JSON.parse(accepted.stdout) as RunReport).checks).toMatchObject([
        { check: 'naming/paths', status: 'passed', findings: [] },
    ]);
});

test('naming policy validates inherited and scoped declarations against the complete source inventory', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': SCOPE_POLICY,
        'entry.sh': 'echo ready\n',
        'web/source.js': 'export const remoteRecord = 1;\n',
        'worker/source.py': 'remote_record = 1\n',
    });
    const command = ['check', '--only', 'naming/policy', '--json'];
    const accepted = await runGspot(sandbox.path, command);
    expect(accepted.code, accepted.stdout + accepted.stderr).toBe(0);
    const complete = JSON.parse(accepted.stdout) as RunReport;
    expect(complete.checks.map(({ check, scope, status }) => ({ check, scope, status }))).toStrictEqual([
        { check: 'naming/policy', scope: '', status: 'passed' },
    ]);
    const narrowed = await runGspot(sandbox.path, ['check', 'entry.sh', '--only', 'naming/policy', '--json']);
    expect(narrowed.code, narrowed.stdout + narrowed.stderr).toBe(0);
    await Bun.write(join(sandbox.path, 'gspot.toml'), MISMATCHED_POLICY);
    const refused = await runGspot(sandbox.path, command);
    expect(refused.code, refused.stdout + refused.stderr).toBe(1);
    const report = JSON.parse(refused.stdout) as RunReport;
    expect(report.checks.flatMap(({ findings }) => findings)).toMatchObject([
        {
            file: 'gspot.toml',
            message: 'naming.allowed names "remoteRecord", which no identifier in this scope carries. (scope worker)',
        },
    ]);
    expect(await Bun.file(join(sandbox.path, 'gspot.toml')).text()).toBe(MISMATCHED_POLICY);
    await Bun.write(join(sandbox.path, 'gspot.toml'), SCOPE_POLICY);
    await Bun.write(join(sandbox.path, 'web/source.js'), 'export const localRecord = 1;\n');
    const unused = await runGspot(sandbox.path, command);
    expect(unused.code, unused.stdout + unused.stderr).toBe(1);
    expect((JSON.parse(unused.stdout) as RunReport).checks.flatMap(({ findings }) => findings)).toHaveLength(2);
    await Bun.write(join(sandbox.path, 'web/source.js'), 'export const remoteRecord = 1;\n');
    renameSync(join(sandbox.path, 'web/source.js'), join(sandbox.path, 'web/renamed.js'));
    const unmatched = await runGspot(sandbox.path, command);
    expect(unmatched.code, unmatched.stdout + unmatched.stderr).toBe(1);
    expect((JSON.parse(unmatched.stdout) as RunReport).checks.flatMap(({ findings }) => findings)).toMatchObject([
        { file: 'gspot.toml', message: 'A [[naming.paths]] entry matches no file: web/source.js.' },
    ]);
    renameSync(join(sandbox.path, 'web/renamed.js'), join(sandbox.path, 'web/source.js'));
    const corrected = await runGspot(sandbox.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([
        { check: 'naming/policy', status: 'passed', findings: [] },
    ]);
    expect(await Bun.file(join(sandbox.path, 'worker/source.py')).text()).toBe('remote_record = 1\n');
});

test.each(['constructor', 'toString', '__proto__'])(
    'unknown case %s stays a policy finding while neighboring identifier checks remain active',
    async (caseName) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['typescript', 'naming'], {
                tables: `[[naming.paths]]\npaths = ["source.ts"]\ncase = ["${caseName}"]\n`,
                level: 'all',
            }),
            'source.ts': 'export const bad_name = 1;\n',
        });
        const command = ['check', '--json', '--only', 'naming/identifiers', 'naming/policy'];
        const failed = await runGspot(sandbox.path, command);
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        const report = JSON.parse(failed.stdout) as RunReport;
        expect(report.checks.map(({ status }) => status)).toStrictEqual(['failed', 'failed']);
        expect(report.checks.flatMap(({ findings }) => findings.map(({ file }) => file))).toContain('gspot.toml');
        await Bun.write(
            join(sandbox.path, 'gspot.toml'),
            buildPolicy(['typescript', 'naming'], {
                tables: '[[naming.paths]]\npaths = ["source.ts"]\ncase = ["camel"]\n',
                level: 'all',
            }),
        );
        const neighbor = await runGspot(sandbox.path, command);
        expect(neighbor.code, neighbor.stdout + neighbor.stderr).toBe(1);
        expect((JSON.parse(neighbor.stdout) as RunReport).checks.flatMap(({ findings }) => findings)).toMatchObject([
            { file: 'source.ts', line: 1, rule: 'case' },
        ]);
        await Bun.write(join(sandbox.path, 'source.ts'), 'export const goodName = 1;\n');
        const corrected = await runGspot(sandbox.path, command);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    },
);

test('the selected naming configuration rejects banned terms in declarations and paths', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['javascript', 'naming'], { level: 'all' }),
        'helper.js': 'export const helperCommand = 1;\n',
        'helper/port.js': 'export const port = 1;\n',
    });
    const command = ['check', '--only', 'naming/identifiers', 'naming/paths', '--json'];
    const refused = await runGspot(sandbox.path, command);
    expect(refused.code, refused.stdout + refused.stderr).toBe(1);
    const report = JSON.parse(refused.stdout) as RunReport;
    expect(report.checks.map((check) => [check.check, check.status])).toStrictEqual([
        ['naming/identifiers', 'failed'],
        ['naming/paths', 'failed'],
    ]);
    expect(report.checks[0]!.findings).toContainEqual(
        containing({ rule: 'banned-term', file: 'helper.js', line: 1, column: 14 }),
    );
    expect(report.checks[1]!.findings).toContainEqual(containing({ rule: 'banned-term', file: 'helper.js', line: 1 }));
    renameSync(join(sandbox.path, 'helper.js'), join(sandbox.path, 'entry.js'));
    renameSync(join(sandbox.path, 'helper'), join(sandbox.path, 'app'));
    await Bun.write(join(sandbox.path, 'entry.js'), 'export const command = 1;\n');
    const accepted = await runGspot(sandbox.path, command);
    expect(accepted.code, accepted.stdout + accepted.stderr).toBe(0);
    expect((JSON.parse(accepted.stdout) as RunReport).checks).toMatchObject([
        { check: 'naming/identifiers', status: 'passed', findings: [] },
        { check: 'naming/paths', status: 'passed', findings: [] },
    ]);
});

test('ordinary service and generation names pass the naming checks in code and paths', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['javascript', 'naming'], { level: 'all' }),
        'service/generate.js': 'export function generate() { return "message"; }\nexport const service = generate();\n',
    });
    const result = await runGspot(sandbox.path, ['check', '--only', 'naming/identifiers', 'naming/paths', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const report = JSON.parse(result.stdout) as RunReport;
    expect(report.checks.map((check) => [check.check, check.status])).toStrictEqual([
        ['naming/identifiers', 'passed'],
        ['naming/paths', 'passed'],
    ]);
});

test('naming test exemptions follow authored, inherited and Swift test conventions without reaching sibling production files', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': TEST_PATH_POLICY, ...TEST_PATH_FILES });
    const result = await runGspot(sandbox.path, ['check', '--only', 'naming/identifiers', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(1);
    const report = JSON.parse(result.stdout) as RunReport;
    expect(report.checks.flatMap(({ findings }) => findings.map(({ file, rule }) => ({ file, rule })))).toStrictEqual([
        { file: 'Sources/Service.swift', rule: 'banned-term' },
        { file: 'src/entry.js', rule: 'banned-term' },
        { file: 'apps/web/src/entry.js', rule: 'banned-term' },
        { file: 'apps/api/verification/entry.js', rule: 'banned-term' },
    ]);
});

test('Next.js Pages Router names preserve an adjacent path finding and accept its correction', async () => {
    await using sandbox = await testdir();
    const source = 'export default function Page() { return null; }\n';
    const pages = ['_app', '_document', '_error', '404', '500'].map((name) => `pages/${name}.tsx`);
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['nextjs', 'naming'], { level: 'all' }),
        ...Object.fromEntries(pages.map((path) => [path, source])),
        'pages/about_page.ts': 'export const title = "About";\n',
    });
    const command = ['check', '--only', 'naming/paths', '--json'];
    const failed = await runGspot(sandbox.path, command);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect((JSON.parse(failed.stdout) as RunReport).checks.flatMap((check) => check.findings)).toMatchObject([
        { file: 'pages/about_page.ts', rule: 'case' },
    ]);
    renameSync(join(sandbox.path, 'pages/about_page.ts'), join(sandbox.path, 'pages/about-page.ts'));
    const corrected = await runGspot(sandbox.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(await Promise.all(pages.map((path) => Bun.file(join(sandbox.path, path)).text()))).toStrictEqual(
        pages.map(() => source),
    );
});
