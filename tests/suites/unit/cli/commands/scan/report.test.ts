import { test, expect } from 'bun:test';
import { planInit } from '#cli/generation/setup/planner.ts';
import type { ScanReport } from '#cli/types/commands/reports.ts';
import { SCAN_RUN_REPORT } from '#tests/config/commands/check.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { formatScanText, buildScanReport, formatScanMarkdown } from '#cli/commands/scan/report.ts';

async function buildSampleReport(): Promise<ScanReport> {
    await using sandbox = await createGitSandbox({ 'README.md': '# Example\n', 'src/a.js': 'export const a = 1;\n' });
    const planning = await planInit(sandbox.path, { cwd: sandbox.path });
    const { session } = planning;
    return buildScanReport({ planning, session, report: SCAN_RUN_REPORT, toolBytes: 3 * 1024 * 1024 });
}

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
    expect(report.checks).toBe(SCAN_RUN_REPORT.checks);
});

test('scan sums the seconds of each tool and of each hook, slowest tool first', async () => {
    const { cost } = await buildSampleReport();
    expect(cost.megabytes).toBe(3);
    expect(cost.perTool).toStrictEqual([
        { name: 'eslint', seconds: 2 },
        { name: 'gitleaks', seconds: 1 },
        { name: 'gspot', seconds: 0.9 },
        { name: 'prettier', seconds: 0.5 },
        { name: 'typos', seconds: 0.5 },
    ]);
    expect(cost.perHook).toStrictEqual([
        { name: 'pre-commit', seconds: 4 },
        { name: 'pre-push', seconds: 4.9 },
    ]);
});

test('the text report prints each section with its rows', async () => {
    const text = formatScanText(await buildSampleReport());
    expect(text).toStartWith('Checked 2 files with 5 checks in 4.2s: 8 findings in 4 files.\n\nSecrets: 1 finding\n');
    expect(text).toContain('  src/key.ts:2  secrets/gitleaks-staged generic-api-key  Detected a key.\n');
    expect(text).toContain('Formatting\n  2 files differ from your style.\n');
    expect(text).toContain('Could not run\n  python/ruff: ruff is not installed.\n');
    expect(text).toContain('  pre-push  4.9s\n');
    expect(text).toContain('What gspot init would do\n  configurations\n');
    expect(text).toEndWith('  mise exec -- gspot init\n  mise exec -- gspot install\n  mise exec -- gspot baseline\n');
});

test('the Markdown report uses headings and lists, and fences the plan', async () => {
    const text = formatScanMarkdown(await buildSampleReport());
    expect(text).toStartWith('# gspot scan\n\nChecked 2 files');
    expect(text).toContain('## Secrets: 1 finding\n\n- src/key.ts:2  secrets/gitleaks-staged generic-api-key');
    expect(text).toContain('## What gspot init would do\n\n```text\nconfigurations\n');
    expect(text).toEndWith('- mise exec -- gspot init\n- mise exec -- gspot install\n- mise exec -- gspot baseline\n');
});

test('the report words one file to format in the singular', async () => {
    const report = await buildSampleReport();
    expect(formatScanText({ ...report, filesToFormat: 1 })).toContain('  1 file differs from your style.\n');
});
