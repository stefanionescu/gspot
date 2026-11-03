import { join } from 'node:path';
import { test, expect } from 'bun:test';
import type { TestdirResult } from 'testdirs';
import { compareText } from '#cli/system/text.ts';
import { commitAll } from '#tests/setup/system/git.ts';
import { unlink, readFile, writeFile } from 'node:fs/promises';
import { BASELINE_SANDBOX } from '#tests/config/commands/check.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { runGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

async function createBaselineSandbox(files: Record<string, string>, tables = ''): Promise<TestdirResult> {
    const sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { ...BASELINE_SANDBOX, tables }),
        ...files,
    });
    commitAll(sandbox.path);
    return sandbox;
}

test('baseline writes a count per file, check, and rule, and check subtracts it', async () => {
    await using sandbox = await createBaselineSandbox({ 'guide.md': 'See `src/one.ts` and `src/two.ts`.\n' });
    const written = await runGspot(sandbox.path, ['baseline', '--json']);
    expect(written.code, written.stdout + written.stderr).toBe(0);
    expect(JSON.parse(written.stdout)).toMatchObject({ findings: 2, files: 1, leftOut: [] });
    const baseline = await readFile(join(sandbox.path, 'gspot.baseline.json'), 'utf8');
    expect(JSON.parse(baseline)).toStrictEqual({ 'guide.md': { 'docs/missing-paths': { 'missing-path': 2 } } });
    const { report, code } = parseCheckReport(await runGspot(sandbox.path, ['check', '--json']));
    expect(code).toBe(0);
    expect(report.baselined).toStrictEqual({ 'docs/missing-paths': 2 });
});

test('check reports the finding that a count has no room for, and prints the baselined total', async () => {
    await using sandbox = await createBaselineSandbox({ 'guide.md': 'See `src/one.ts`.\n' });
    await runGspot(sandbox.path, ['baseline']);
    const clean = await runGspot(sandbox.path, ['check']);
    expect(clean.stdout).toContain('baselined  1 (counted in gspot.baseline.json)\n');
    await writeFile(join(sandbox.path, 'guide.md'), 'See `src/one.ts`.\nSee `src/two.ts`.\n');
    const { report, code } = parseCheckReport(await runGspot(sandbox.path, ['check', '--json']));
    expect(code).toBe(1);
    expect(report.checks.flatMap(({ findings }) => findings.map(({ file }) => file))).toStrictEqual(['guide.md']);
    expect(report.baselined).toStrictEqual({ 'docs/missing-paths': 1 });
});

test('a stale count fails gspot/baseline until --prune lowers it, and --prune adds nothing', async () => {
    await using sandbox = await createBaselineSandbox({
        'guide.md': 'See `src/one.ts` and `src/two.ts`.\n',
        'notes.md': 'The notes name no path.\n',
    });
    await runGspot(sandbox.path, ['baseline']);
    await writeFile(join(sandbox.path, 'guide.md'), 'See `src/one.ts`.\n');
    await writeFile(join(sandbox.path, 'notes.md'), 'See `src/three.ts`.\n');
    const stale = parseCheckReport(
        await runGspot(sandbox.path, ['check', '--only', 'docs/missing-paths,gspot/baseline', '--json']),
    );
    expect(stale.code).toBe(1);
    expect(stale.report.checks.find(({ check }) => check === 'gspot/baseline')?.findings).toMatchObject([
        {
            file: 'guide.md',
            rule: 'stale-baseline',
            message:
                'gspot.baseline.json counts 1 finding of docs/missing-paths missing-path that the run did not find.',
        },
    ]);
    const pruned = await runGspot(sandbox.path, ['baseline', '--prune']);
    expect(pruned.code, pruned.stdout + pruned.stderr).toBe(0);
    expect(pruned.stdout).toBe('Removed 1 finding from gspot.baseline.json. It holds 1 finding in 1 file.\n');
    const prunedBaseline = await readFile(join(sandbox.path, 'gspot.baseline.json'), 'utf8');
    expect(JSON.parse(prunedBaseline)).toStrictEqual({ 'guide.md': { 'docs/missing-paths': { 'missing-path': 1 } } });
});

test('a count of a deleted file is stale in a run of one check', async () => {
    await using sandbox = await createBaselineSandbox({
        'guide.md': 'See `src/one.ts`.\n',
        'notes.md': 'The notes name no path.\n',
    });
    await runGspot(sandbox.path, ['baseline']);
    await unlink(join(sandbox.path, 'guide.md'));
    commitAll(sandbox.path);
    const { report, code } = parseCheckReport(
        await runGspot(sandbox.path, ['check', '--only', 'gspot/baseline', '--json']),
    );
    expect(code).toBe(1);
    expect(report.checks[0]?.findings).toMatchObject([{ file: 'guide.md', rule: 'stale-baseline' }]);
});

test('a secret never enters the baseline, and check reports a count that someone wrote for one', async () => {
    await using sandbox = await createBaselineSandbox({
        '.env.example': 'OTHER=\n',
        'source.js': 'export const value = process.env.API_URL;\n',
    });
    const written = await runGspot(sandbox.path, ['baseline', '--json']);
    expect(written.code, written.stdout + written.stderr).toBe(0);
    expect(JSON.parse(written.stdout)).toMatchObject({ findings: 0, leftOut: ['secrets/environment-examples'] });
    const baseline = await readFile(join(sandbox.path, 'gspot.baseline.json'), 'utf8');
    expect(JSON.parse(baseline)).toStrictEqual({});
    await writeFile(
        join(sandbox.path, 'gspot.baseline.json'),
        '{"source.js":{"secrets/environment-examples":{"secrets/environment-examples":1}}}\n',
    );
    const { report, code } = parseCheckReport(await runGspot(sandbox.path, ['check', '--json']));
    expect(code).toBe(1);
    expect(report.baselined).toStrictEqual({});
    expect(
        report.checks.flatMap(({ findings }) => findings.map(({ check }) => check)).toSorted(compareText),
    ).toStrictEqual(['gspot/baseline', 'secrets/environment-examples']);
});

test('baseline leaves the file alone when a check cannot run', async () => {
    await using sandbox = await createBaselineSandbox(
        { 'guide.md': 'See `src/one.ts`.\n' },
        '[[command_check]]\nid = "missing/tool"\ncommand = ["gspot-missing-tool"]\npaths = ["**"]\nstage = "commit"\nsummary = "Runs a tool."\nhelp = "Install it."\noutput = { format = "none" }\n',
    );
    const refused = await runGspot(sandbox.path, ['baseline']);
    expect(refused.code).toBe(2);
    expect(refused.stderr).toEndWith(
        'gspot baseline needs every check to run, and missing/tool could not:\n  missing/tool: gspot-missing-tool is not installed. Install gspot-missing-tool.\n',
    );
    const pruned = await runGspot(sandbox.path, ['baseline', '--prune']);
    expect(pruned.code).toBe(2);
    expect(pruned.stderr).toBe('This repository has no gspot.baseline.json to prune. Run gspot baseline.\n');
});

test('--prune lowers the counts of the checks that ran and keeps those of a check that did not run', async () => {
    await using sandbox = await createBaselineSandbox(
        { 'guide.md': 'See `src/one.ts` and `src/two.ts`.\n' },
        '[[command_check]]\nid = "missing/tool"\ncommand = ["gspot-missing-tool"]\npaths = ["**"]\nstage = "commit"\nsummary = "Runs a tool."\nhelp = "Install it."\noutput = { format = "none" }\n',
    );
    const counts = {
        'guide.md': { 'docs/missing-paths': { 'missing-path': 2 }, 'missing/tool': { 'missing/tool': 1 } },
    };
    await writeFile(join(sandbox.path, 'gspot.baseline.json'), `${JSON.stringify(counts)}\n`);
    await writeFile(join(sandbox.path, 'guide.md'), 'See `src/one.ts`.\n');
    const pruned = await runGspot(sandbox.path, ['baseline', '--prune']);
    expect(pruned.code, pruned.stdout + pruned.stderr).toBe(0);
    expect(pruned.stdout).toEndWith(
        'Removed 1 finding from gspot.baseline.json. It holds 2 findings in 1 file. It keeps the counts of missing/tool, which did not run.\n',
    );
    const written = await readFile(join(sandbox.path, 'gspot.baseline.json'), 'utf8');
    expect(JSON.parse(written)).toStrictEqual({
        'guide.md': { 'docs/missing-paths': { 'missing-path': 1 }, 'missing/tool': { 'missing/tool': 1 } },
    });
});

test('writing the generated files keeps the baseline, and no generated-file check reports it', async () => {
    await using sandbox = await createBaselineSandbox({ 'guide.md': 'See `src/one.ts`.\n' });
    await runGspot(sandbox.path, ['baseline']);
    const before = await readFile(join(sandbox.path, 'gspot.baseline.json'), 'utf8');
    await applyGeneratedFiles(sandbox.path);
    expect(await readFile(join(sandbox.path, 'gspot.baseline.json'), 'utf8')).toBe(before);
});
