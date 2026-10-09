import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { rename } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { runGspot, checkReport } from '#tests/harness/gspot.ts';
import { containing, textContaining } from '#tests/harness/expectations.ts';
import { SCOPE_POLICY, TEST_PATH_FILES, TEST_PATH_POLICY } from '#tests/config/cli/checks/general/naming/policy.ts';

const MISMATCHED_POLICY = SCOPE_POLICY.replace('remote_record =', 'remoteRecord =');

function policyRows(report: RunReport) {
    return report.checks.map(({ check, status, findings }) => ({
        check,
        status,
        findings: findings.map(({ file, line, rule, message }) => ({ file, line, rule, message })),
    }));
}

test('external property allowances retain adjacent local signature findings through the CLI', async () => {
    await using sandbox = await testdir();
    const source =
        'export type Template = {\n    external_key: string;\n    user_name: string;\n    USER_COUNT: number;\n};\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['typescript', 'naming'], {
            tables: '[[naming.overrides]]\npaths = ["source.ts"]\ncategories = ["properties"]\nnames = ["external_key"]\ncase = ["snake"]\nreason = "The remote API fixes this exact property key."\n',
            level: 'all',
        }),
        'source.ts': source,
    });
    const command = ['check', '--json', '--only', 'naming/identifiers'];
    const failed = await checkReport(sandbox.path, command);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    const report = failed.report;
    expect(
        report.checks.flatMap(({ findings }) =>
            findings.map(({ file, line, column, rule }) => ({ file, line, column, rule })),
        ),
    ).toStrictEqual([{ file: 'source.ts', line: 3, column: 5, rule: 'case' }]);
    await Bun.write(join(sandbox.path, 'source.ts'), source.replace('user_name', 'userName'));
    const corrected = await runGspot(sandbox.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
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

test('naming policy validates inherited and scoped declarations against the complete source inventory', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': SCOPE_POLICY,
        'entry.sh': 'echo ready\n',
        'web/source.js': 'export const remoteRecord = 1;\n',
        'worker/source.py': 'remote_record = 1\n',
    });
    const command = ['check', '--only', 'naming/policy', '--json'];
    const accepted = await checkReport(sandbox.path, command);
    expect(accepted.code, accepted.stdout + accepted.stderr).toBe(0);
    const complete = accepted.report;
    expect(complete.checks.map(({ check, scope, status }) => ({ check, scope, status }))).toStrictEqual([
        { check: 'naming/policy', scope: '', status: 'passed' },
    ]);
    const narrowed = await checkReport(sandbox.path, ['check', 'entry.sh', '--only', 'naming/policy', '--json']);
    expect(narrowed.code, narrowed.stdout + narrowed.stderr).toBe(0);
    expect(narrowed.report.checks.map(({ check, status }) => ({ check, status }))).toStrictEqual([
        { check: 'naming/policy', status: 'passed' },
    ]);
    await Bun.write(join(sandbox.path, 'gspot.toml'), MISMATCHED_POLICY);
    const refused = await checkReport(sandbox.path, command);
    expect(refused.code, refused.stdout + refused.stderr).toBe(1);
    expect(policyRows(refused.report)).toStrictEqual([
        {
            check: 'naming/policy',
            status: 'failed',
            findings: [
                { file: 'gspot.toml', line: undefined, rule: 'stale-entry', message: textContaining('remoteRecord') },
            ],
        },
    ]);
    await Bun.write(join(sandbox.path, 'gspot.toml'), SCOPE_POLICY);
    await Bun.write(join(sandbox.path, 'web/source.js'), 'export const localRecord = 1;\n');
    const unused = await checkReport(sandbox.path, command);
    expect(unused.code, unused.stdout + unused.stderr).toBe(1);
    expect(unused.report.checks.flatMap(({ findings }) => findings)).toMatchObject([
        { file: 'gspot.toml', rule: 'stale-entry', message: textContaining('naming.allowed names "remoteRecord"') },
        { file: 'gspot.toml', rule: 'stale-entry', message: textContaining('naming.allowed names "remoteRecord"') },
    ]);
    await Bun.write(join(sandbox.path, 'web/source.js'), 'export const remoteRecord = 1;\n');
    await rename(join(sandbox.path, 'web/source.js'), join(sandbox.path, 'web/renamed.js'));
    const unmatched = await checkReport(sandbox.path, command);
    expect(unmatched.code, unmatched.stdout + unmatched.stderr).toBe(1);
    expect(policyRows(unmatched.report)).toStrictEqual([
        {
            check: 'naming/policy',
            status: 'failed',
            findings: [
                { file: 'gspot.toml', line: undefined, rule: 'stale-entry', message: textContaining('web/source.js') },
            ],
        },
    ]);
    await rename(join(sandbox.path, 'web/renamed.js'), join(sandbox.path, 'web/source.js'));
    const corrected = await checkReport(sandbox.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(corrected.report.checks).toMatchObject([{ check: 'naming/policy', status: 'passed', findings: [] }]);
});

test('an unknown prototype case stays a policy finding while neighboring identifier checks remain active', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['typescript', 'naming'], {
            tables: `[[naming.overrides]]\npaths = ["source.ts"]\ncase = ["__proto__"]\n`,
            level: 'all',
        }),
        'source.ts': 'export const bad_name = 1;\n',
    });
    const command = ['check', '--json', '--only', 'naming/identifiers', 'naming/policy'];
    const failed = await checkReport(sandbox.path, command);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    const report = failed.report;
    expect(report.checks.map(({ status }) => status)).toStrictEqual(['failed', 'failed']);
    expect(report.checks.find(({ check }) => check === 'naming/policy')?.findings).toContainEqual(
        containing({ file: 'gspot.toml', rule: 'stale-entry', message: textContaining('__proto__') }),
    );
    await Bun.write(
        join(sandbox.path, 'gspot.toml'),
        buildPolicy(['typescript', 'naming'], {
            tables: '[[naming.overrides]]\npaths = ["source.ts"]\ncase = ["camel"]\n',
            level: 'all',
        }),
    );
    const neighbor = await checkReport(sandbox.path, command);
    expect(neighbor.code, neighbor.stdout + neighbor.stderr).toBe(1);
    expect(neighbor.report.checks.flatMap(({ findings }) => findings)).toMatchObject([
        { file: 'source.ts', line: 1, rule: 'case' },
    ]);
    await Bun.write(join(sandbox.path, 'source.ts'), 'export const goodName = 1;\n');
    const corrected = await runGspot(sandbox.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
});

test('the selected naming configuration rejects banned terms in declarations and paths', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['javascript', 'naming'], { level: 'all' }),
        'helper.js': 'export const helperCommand = 1;\n',
        'helper/port.js': 'export const port = 1;\n',
    });
    const command = ['check', '--only', 'naming/identifiers', 'naming/paths', '--json'];
    const refused = await checkReport(sandbox.path, command);
    expect(refused.code, refused.stdout + refused.stderr).toBe(1);
    const report = refused.report;
    expect(report.checks.map((check) => [check.check, check.status])).toStrictEqual([
        ['naming/identifiers', 'failed'],
        ['naming/paths', 'failed'],
    ]);
    expect(report.checks[0]!.findings).toContainEqual(
        containing({ rule: 'banned-term', file: 'helper.js', line: 1, column: 14 }),
    );
    for (const file of ['helper.js', 'helper/port.js'])
        expect(report.checks[1]!.findings).toContainEqual(containing({ rule: 'banned-term', file, line: 1 }));
    await rename(join(sandbox.path, 'helper.js'), join(sandbox.path, 'entry.js'));
    await rename(join(sandbox.path, 'helper'), join(sandbox.path, 'app'));
    await Bun.write(join(sandbox.path, 'entry.js'), 'export const command = 1;\n');
    const accepted = await checkReport(sandbox.path, command);
    expect(accepted.code, accepted.stdout + accepted.stderr).toBe(0);
    expect(accepted.report.checks).toMatchObject([
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
    const result = await checkReport(sandbox.path, ['check', '--only', 'naming/identifiers', 'naming/paths', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const report = result.report;
    expect(report.checks.map((check) => [check.check, check.status])).toStrictEqual([
        ['naming/identifiers', 'passed'],
        ['naming/paths', 'passed'],
    ]);
});

test('naming test exemptions follow authored, inherited and Swift test conventions without reaching sibling production files', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': TEST_PATH_POLICY, ...TEST_PATH_FILES });
    const result = await checkReport(sandbox.path, ['check', '--only', 'naming/identifiers', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(1);
    const report = result.report;
    expect(report.checks.flatMap(({ findings }) => findings.map(({ file, rule }) => ({ file, rule })))).toStrictEqual([
        { file: 'Sources/Service.swift', rule: 'banned-term' },
        { file: 'src/entry.js', rule: 'banned-term' },
        { file: 'apps/web/qa/entry.js', rule: 'banned-term' },
        { file: 'apps/web/src/entry.js', rule: 'banned-term' },
        { file: 'apps/api/verification/entry.js', rule: 'banned-term' },
    ]);
});

test('Next.js Pages Router names preserve an adjacent path finding and pass after the fix', async () => {
    await using sandbox = await testdir();
    const source = 'export default function Page() { return null; }\n';
    const pages = ['_app', '_document', '_error', '404', '500'].map((name) => `pages/${name}.tsx`);
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['nextjs', 'naming'], { level: 'all' }),
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
    expect(await Promise.all(pages.map((path) => Bun.file(join(sandbox.path, path)).text()))).toStrictEqual(
        pages.map(() => source),
    );
});
