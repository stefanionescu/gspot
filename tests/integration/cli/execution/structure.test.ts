import { join } from 'node:path';
import { renameSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { CHECKS } from '#cli/checks/registry.ts';
import { testdir, createFileTree } from 'testdirs';
import { commitAll } from '#tests/harness/cli/git.ts';
import { executeRun } from '#cli/execution/execute.ts';
import { openSession } from '#cli/execution/session.ts';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { onPosix } from '#tests/harness/cli/platforms.ts';
import { runOptions } from '#tests/harness/cli/command.ts';

const PAGE = '<script>\n    let count = 0;\n</script>\n<p>{count}</p>\n';

test('folder checks count code files and preserve allowed and nested directories', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': policyOf(
            ['typescript'],
            '[structure]\nsingle_file_folder_allowed = [{ paths = ["allowed/**"], reason = "Required entry directory." }]\n',
            'all',
        ),
        'lone/only.ts': '',
        'typed/one.ts': '',
        'typed/one.d.ts': '',
        'pair/first.ts': '',
        'pair/second.ts': '',
        'component/logic.ts': '',
        'component/View.astro': '<main>Example</main>',
        'schema/parser.ts': '',
        'schema/schema.json': '{}',
        'parent/main.ts': '',
        'parent/child/first.ts': '',
        'parent/child/second.ts': '',
        'dist/pkg/lone.ts': '',
        'allowed/only.ts': '',
    });
    const result = await executeRun(
        await openSession(sandbox.path),
        runOptions({ only: ['structure/single-file-folder'] }),
    );
    expect(result.report.exitCode).toBe(1);
    expect(result.report.checks.flatMap((check) => check.findings.map((finding) => finding.file))).toStrictEqual([
        'dist/pkg/lone.ts',
        'lone/only.ts',
        'typed/one.ts',
    ]);
});

test('prefix checks group files and directories once and honor allowances and the threshold', async () => {
    const policy = policyOf(['typescript'], '', 'all');
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': policy,
        'cards/asset-card.ts': '',
        'cards/asset-list.ts': '',
        'cards/asset-row.ts': '',
        'cards/other.ts': '',
        'mixed/turn.ts': '',
        'mixed/turn-flow/first.ts': '',
        'mixed/turn-flow/second.ts': '',
        'fine/index.ts': '',
        'fine/index-page.ts': '',
        'fine/first.ts': '',
        'fine/second.ts': '',
        'paired/api.ts': '',
        'paired/api.d.ts': '',
        'paired/social.png': '',
        'paired/social.svg': '',
        // The package managers fix these names.
        'npm/package.json': '{}',
        'npm/package-lock.json': '{}',
        'pnpm/pnpm-lock.yaml': '',
        'pnpm/pnpm-workspace.yaml': '',
    });
    const options = runOptions({ only: ['structure/prefix-collisions'] });
    const initial = await executeRun(await openSession(sandbox.path), { ...options, checks: CHECKS });
    expect(initial.report.checks[0]?.findings).toMatchObject([
        { file: 'cards/asset-card.ts', rule: 'shared-prefix' },
        { file: 'mixed/turn.ts', rule: 'shared-prefix' },
    ]);
    expect(initial.report.checks[0]?.findings).toHaveLength(2);
    const allowed =
        policy +
        '[structure]\nprefix_collision_allowed = [{ paths = ["cards/**"], reason = "Required public names." }]\n';
    await Bun.write(join(sandbox.path, 'gspot.toml'), allowed);
    const retained = await executeRun(await openSession(sandbox.path), { ...options, checks: CHECKS });
    expect(retained.report.checks[0]?.findings).toMatchObject([{ file: 'mixed/turn.ts' }]);
    expect(retained.report.checks[0]?.findings).toHaveLength(1);
    await Bun.write(
        join(sandbox.path, 'gspot.toml'),
        allowed + '[limits]\nprefix_collisions = { value = 3, reason = "Required grouping threshold." }\n',
    );
    const raised = await executeRun(await openSession(sandbox.path), { ...options, checks: CHECKS });
    expect(raised.report.exitCode).toBe(0);
});

test.each([
    ['typescript', 'ts'],
    ['swift', 'swift'],
    ['python', 'py'],
])('%s retains shared folder enforcement and reads corrections', async (configuration, extension) => {
    const language = { ts: 'typescript', tsx: 'typescript', swift: 'swift', py: 'python' }[extension] ?? 'javascript';
    const lone = `feature/only.${extension}`;
    const card = `cards/asset-card.${extension}`;
    const list = `cards/asset-list.${extension}`;
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': policyOf([configuration, language, 'structure'], '', 'all'),
        [lone]: '',
        [card]: '',
        [list]: '',
    });
    const options = runOptions({ only: ['structure/single-file-folder', 'structure/prefix-collisions'] });
    const initial = await executeRun(await openSession(sandbox.path), { ...options, checks: CHECKS });
    expect(initial.report.exitCode).toBe(1);
    expect(initial.report.checks.flatMap((check) => check.findings)).toMatchObject([
        { check: 'structure/single-file-folder', file: lone, line: 1, rule: 'lone-file' },
        { check: 'structure/prefix-collisions', file: card, line: 1, rule: 'shared-prefix' },
    ]);
    await Bun.write(join(sandbox.path, `feature/second.${extension}`), '');
    renameSync(join(sandbox.path, list), join(sandbox.path, `cards/other.${extension}`));
    const corrected = await executeRun(await openSession(sandbox.path), { ...options, checks: CHECKS });
    expect(corrected.report.checks).toHaveLength(2);
    expect(corrected.report.checks.flatMap((check) => check.findings)).toStrictEqual([]);
    expect(corrected.report.exitCode).toBe(0);
});

if (onPosix)
    test('prefix groups remain distinct when directory and prefix contain newlines', async () => {
        await using sandbox = await testdir();
        const paths = ['a\nb/c-one.ts', 'a\nb/c-two.ts', 'a/b\nc-one.ts', 'a/b\nc-two.ts'];
        await createFileTree(sandbox.path, {
            'gspot.toml': policyOf(['typescript'], '', 'all'),
            ...Object.fromEntries(paths.map((path) => [path, 'export const value = 1;\n'])),
        });
        commitAll(sandbox.path);
        const options = runOptions({ only: ['structure/prefix-collisions'] });
        const initial = await executeRun(await openSession(sandbox.path), { ...options, checks: CHECKS });
        expect(
            initial.report.checks[0]!.findings.map((finding) => finding.file).toSorted((left, right) =>
                left.localeCompare(right),
            ),
        ).toStrictEqual([paths[0]!, paths[2]!].toSorted((left, right) => left.localeCompare(right)));
        renameSync(join(sandbox.path, paths[1]!), join(sandbox.path, 'a\nb/other.ts'));
        renameSync(join(sandbox.path, paths[3]!), join(sandbox.path, 'a/other.ts'));
        commitAll(sandbox.path);
        const corrected = await executeRun(await openSession(sandbox.path), { ...options, checks: CHECKS });
        expect(corrected.report.exitCode).toBe(0);
        expect(corrected.report.checks[0]!.findings).toStrictEqual([]);
    });

test.each(['', 'nested'])('naming checks leave the harness folder of scope %j alone', async (scope) => {
    await using sandbox = await testdir();
    const prefix = scope === '' ? '' : `${scope}/`;
    const scopePolicy = scope === '' ? '' : `\n[[scope]]\npath = "${scope}"\nkits = []\n`;
    await createFileTree(sandbox.path, {
        'gspot.toml': policyOf(
            ['typescript', 'naming'],
            `[architecture.roles]\nharness = "tests/helpers"\n${scopePolicy}`,
            'all',
        ),
        [`${prefix}tests/helpers/startup.ts`]: '',
        [`${prefix}app/support/startup.ts`]: '',
    });
    const result = await executeRun(
        await openSession(sandbox.path),
        runOptions({ only: ['structure/folder-names', 'naming/paths'] }),
    );
    expect(result.report.checks.flatMap((check) => check.findings)).toMatchObject([
        { check: 'structure/folder-names', file: `${prefix}app/support/startup.ts`, line: 1, rule: 'container-name' },
        { check: 'naming/paths', file: `${prefix}app/support/startup.ts`, line: 1, rule: 'banned-term' },
    ]);
});

test.each(['recommended', 'all'])('structural checks classify output directories by ownership at %s', async (level) => {
    await using sandbox = await testdir();
    const authored = Object.fromEntries(
        ['build', 'dist', 'coverage'].flatMap((directory) => [
            [`${directory}/lone/only.ts`, ''],
            [`${directory}/cards/asset-one.ts`, ''],
            [`${directory}/cards/asset-two.ts`, ''],
        ]),
    );
    await createFileTree(sandbox.path, {
        'gspot.toml': policyOf(
            ['typescript'],
            '[[generated]]\npaths = ["emitted/**"]\nreason = "The compiler owns emitted files."\n',
            level,
        ),
        ...authored,
        'emitted/lone/only.ts': '',
        'emitted/cards/asset-one.ts': '',
        'emitted/cards/asset-two.ts': '',
    });
    const result = await executeRun(
        await openSession(sandbox.path),
        runOptions({ stage: 'commit', only: ['structure/single-file-folder', 'structure/prefix-collisions'] }),
    );
    const findings = result.report.checks.flatMap((check) => check.findings);
    expect(findings.map(({ file }) => file).toSorted((left, right) => left.localeCompare(right))).toStrictEqual(
        level === 'all'
            ? ['build', 'dist', 'coverage']
                  .flatMap((directory) => [`${directory}/lone/only.ts`, `${directory}/cards/asset-one.ts`])
                  .toSorted((left, right) => left.localeCompare(right))
            : [],
    );
    expect(result.report.exitCode).toBe(level === 'all' ? 1 : 0);
});

// A framework allows its own one-file folders through the setting default it declares; the repository adds its own.
async function loneFiles(root: string): Promise<string[]> {
    const result = await executeRun(await openSession(root), runOptions({ only: ['structure/single-file-folder'] }));
    return result.report.checks.flatMap((check) => check.findings.map((finding) => finding.file));
}

test('SvelteKit route folders hold one page each without a finding, and other lone files still report', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': policyOf(['javascript', 'svelte'], '', 'all'),
        'package.json': '{"name":"planted","private":true,"type":"module"}\n',
        'src/routes/about/+page.svelte': PAGE,
        'src/routes/blog/[slug]/+page.svelte': PAGE,
        'src/lib/lone/util.js': 'export const answer = 42;\n',
    });
    expect(await loneFiles(sandbox.path)).toStrictEqual(['src/lib/lone/util.js']);
});

test('the repository allowance joins the framework allowance instead of replacing it', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': policyOf(
            ['javascript', 'svelte'],
            '[structure]\nsingle_file_folder_allowed = [{ paths = ["src/lib/lone/**"], reason = "Required entry directory." }]\n',
            'all',
        ),
        'package.json': '{"name":"planted","private":true,"type":"module"}\n',
        'src/routes/about/+page.svelte': PAGE,
        'src/lib/lone/util.js': 'export const answer = 42;\n',
        'src/lib/other/util.js': 'export const answer = 42;\n',
    });
    expect(await loneFiles(sandbox.path)).toStrictEqual(['src/lib/other/util.js']);
});
