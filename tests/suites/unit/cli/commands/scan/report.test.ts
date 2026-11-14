import { test, expect } from 'bun:test';
import type { ScanReport } from '#cli/types/commands.ts';
import { planInit } from '#cli/generation/setup/planner.ts';
import { SCAN_RUN_REPORT } from '#tests/config/commands/setup.ts';
import type { Finding, CheckResult } from '#cli/types/engine/run.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { MISE_NODE_PIN_COMMAND } from '#cli/config/repository/projects.ts';
import { formatScanText, buildScanReport } from '#cli/commands/scan/report.ts';

function buildRuffFinding(rule: string, line: number): Finding {
    return { check: 'python/ruff', file: 'a.py', line, rule, message: 'A message.', fixable: false };
}

async function buildSampleReport(): Promise<ScanReport> {
    await using sandbox = await createGitSandbox({ 'README.md': '# Example\n', 'src/a.js': 'export const a = 1;\n' });
    const planning = await planInit(sandbox.path, {});
    const { session } = planning;
    return buildScanReport({
        planning,
        session,
        report: SCAN_RUN_REPORT,
        toolBytes: 3 * 1024 * 1024,
        ruleRows: [],
        leftOut: ['vitest/tests'],
    });
}

test('scan prints the commands that would break and what init carries once, before the plan', async () => {
    await using sandbox = await createGitSandbox({
        '.prettierrc.json': '{"semi":false,"quoteProps":"consistent"}',
        'package.json': '{"private":true,"scripts":{"lint":"eslint ."}}\n',
        'src/a.js': 'export const a = 1;\n',
    });
    const planning = await planInit(sandbox.path, {});
    const { session } = planning;
    const report = buildScanReport({
        planning,
        session,
        report: SCAN_RUN_REPORT,
        toolBytes: 0,
        ruleRows: [],
        leftOut: ['vitest/tests'],
    });
    const text = formatScanText(report);
    expect(text).toContain(
        'Commands that would break\n  package.json:1  eslint .  Replace the lint and format parts of this script with gspot check.',
    );
    expect(text).toContain(
        'What gspot init would carry over and drop\n  .prettierrc.json  carried over: semi; dropped: quoteProps',
    );
    expect(text.match(/Replace the lint and format parts/gu)).toHaveLength(1);
});

test('scan lists real problems first, keeps three examples, and counts formatting apart', async () => {
    const report = await buildSampleReport();
    expect(report.categories.map(({ name, count }) => [name, count])).toStrictEqual([
        ['Secrets', 1],
        ['Code', 4],
        ['Docs and spelling', 1],
    ]);
    expect(report.categories[1]?.examples.map(({ line }) => line)).toStrictEqual([1, 2, 3]);
    expect(report.filesToFormat).toBe(2);
    expect(report.totals).toMatchObject({ checks: 5, findings: 8, filesFlagged: 4, seconds: 4.2 });
    expect(report.notRun).toStrictEqual(['python/ruff: ruff is not installed.']);
});

test('scan counts a check once, however many scopes ran it', async () => {
    await using sandbox = await createGitSandbox({ 'README.md': '# Example\n' });
    const planning = await planInit(sandbox.path, {});
    const [check] = SCAN_RUN_REPORT.checks as [CheckResult];
    const report = buildScanReport({
        planning,
        session: planning.session,
        report: {
            ...SCAN_RUN_REPORT,
            checks: [check, { ...check, scope: 'api' }, { ...check, scope: 'web', status: 'passed', findings: [] }],
        },
        toolBytes: 0,
        ruleRows: [],
        leftOut: [],
    });
    expect(report.totals.checks).toBe(1);
});

test('scan names the largest rules, takes examples from the largest, and groups what did not run by cause', async () => {
    await using sandbox = await createGitSandbox({ 'README.md': '# Example\n' });
    const planning = await planInit(sandbox.path, {});
    const base = { scope: '', fileCount: 1, duration: 1 };
    const checks = [
        {
            ...base,
            check: 'python/ruff',
            status: 'failed' as const,
            findings: [buildRuffFinding('E1', 1), buildRuffFinding('E2', 2), buildRuffFinding('E2', 3)],
        },
        ...['a/one', 'a/two'].map((check) => ({
            ...base,
            check,
            status: 'missing' as const,
            note: 'Install it.',
            findings: [],
        })),
    ];
    const report = buildScanReport({
        planning,
        session: planning.session,
        report: { ...SCAN_RUN_REPORT, checks },
        toolBytes: 0,
        ruleRows: [],
        leftOut: [],
    });
    expect(report.categories[0]).toMatchObject({
        rules: [
            { check: 'python/ruff', rule: 'E2', count: 2 },
            { check: 'python/ruff', rule: 'E1', count: 1 },
        ],
    });
    expect(report.categories[0]?.examples.map(({ line }) => line)).toStrictEqual([2, 3]);
    expect(report.notRun).toStrictEqual(['a/one, a/two: Install it.']);
    expect(formatScanText(report)).toContain(
        'To leave a rule out: gspot ignore python/ruff --rule E2 --reason "<why>"',
    );
});

test('scan quotes a rule that a shell would split in the ignore line', async () => {
    await using sandbox = await createGitSandbox({ 'README.md': '# Example\n' });
    const planning = await planInit(sandbox.path, {});
    const report = buildScanReport({
        planning,
        session: planning.session,
        report: {
            ...SCAN_RUN_REPORT,
            checks: [
                {
                    scope: '',
                    fileCount: 1,
                    duration: 1,
                    check: 'python/ruff',
                    status: 'failed',
                    findings: [buildRuffFinding('two words', 1)],
                },
            ],
        },
        toolBytes: 0,
        ruleRows: [],
        leftOut: [],
    });
    expect(formatScanText(report)).toContain(
        `To leave a rule out: gspot ignore python/ruff --rule 'two words' --reason "<why>"`,
    );
});

test('scan counts the findings of a check that names no rule, and takes its examples when it is the largest', async () => {
    await using sandbox = await createGitSandbox({ 'README.md': '# Example\n' });
    const planning = await planInit(sandbox.path, {});
    const base = { scope: '', status: 'failed' as const, fileCount: 1, duration: 1 };
    const typo = { check: 'spelling/typos', file: 'README.md', message: 'A typo.', fixable: true };
    const heading = { check: 'markdown/markdownlint', file: 'README.md', line: 9, rule: 'MD001', message: 'A jump.' };
    const report = buildScanReport({
        planning,
        session: planning.session,
        report: {
            ...SCAN_RUN_REPORT,
            checks: [
                { ...base, check: heading.check, findings: [{ ...heading, fixable: false }] },
                { ...base, check: typo.check, findings: [1, 2].map((line) => ({ ...typo, line })) },
            ],
        },
        toolBytes: 0,
        ruleRows: [],
        leftOut: [],
    });
    expect(report.categories[0]).toMatchObject({
        rules: [
            { check: 'spelling/typos', rule: '', count: 2 },
            { check: 'markdown/markdownlint', rule: 'MD001', count: 1 },
        ],
    });
    expect(report.categories[0]?.examples.map(({ line }) => line)).toStrictEqual([1, 2]);
    const text = formatScanText(report);
    expect(text).toContain('  spelling/typos  2 findings\n');
    expect(text).toContain('To leave files out: gspot ignore spelling/typos --paths <path> --reason "<why>"');
});

test('scan names paths in the ignore line of a check whose one rule gspot ignore refuses', async () => {
    await using sandbox = await createGitSandbox({ 'README.md': '# Example\n' });
    const planning = await planInit(sandbox.path, {});
    const finding = {
        check: 'gspot/suppressions',
        file: 'a.py',
        line: 1,
        rule: 'ruff-no-reason',
        message: 'This ruff suppression has no reason of two or more words.',
        fixable: false,
    };
    const text = formatScanText(
        buildScanReport({
            planning,
            session: planning.session,
            report: {
                ...SCAN_RUN_REPORT,
                checks: [
                    {
                        check: finding.check,
                        scope: '',
                        status: 'failed' as const,
                        fileCount: 1,
                        duration: 1,
                        findings: [finding],
                    },
                ],
            },
            toolBytes: 0,
            ruleRows: [],
            leftOut: [],
        }),
    );
    expect(text).toContain('gspot ignore gspot/suppressions --paths <path> --reason "<why>"');
    expect(text).not.toContain('gspot ignore gspot/suppressions --rule');
});

test.each([
    { name: 'pins Node.js first when mise.toml names none', files: {}, pinsNode: true },
    { name: 'leaves a Node.js pin alone', files: { 'mise.toml': '[tools]\nnode = "22"\n' }, pinsNode: false },
])('the next steps of a mise repository $name', async ({ files, pinsNode }) => {
    await using sandbox = await createGitSandbox({ 'README.md': '# Example\n', ...files });
    const planning = await planInit(sandbox.path, {});
    const { nextSteps } = buildScanReport({
        planning,
        session: planning.session,
        report: SCAN_RUN_REPORT,
        toolBytes: 0,
        ruleRows: [],
        leftOut: [],
    });
    expect(nextSteps.includes(MISE_NODE_PIN_COMMAND)).toBe(pinsNode);
    expect(nextSteps.findIndex((step) => step.includes('@gspothq/cli'))).toBe(pinsNode ? 1 : 0);
});

test('scan sums the seconds of each tool, slowest tool first', async () => {
    const { cost } = await buildSampleReport();
    expect(cost.megabytes).toBe(3);
    expect(cost.perTool).toStrictEqual([
        { name: 'eslint', seconds: 2 },
        { name: 'gitleaks', seconds: 1 },
        { name: 'gspot', seconds: 0.9 },
        { name: 'prettier', seconds: 0.5 },
        { name: 'typos', seconds: 0.5 },
    ]);
});
