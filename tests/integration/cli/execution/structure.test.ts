import { join } from 'node:path';
import { renameSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { commitAll } from '#tests/support/cli/git.ts';
import { executeRun } from '#cli/execution/execute.ts';
import { openSession } from '#cli/execution/session.ts';
import { onPosix } from '#tests/support/cli/platforms.ts';
import { policyOf } from '#tests/support/cli/policy/text.ts';

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
    const result = await executeRun(await openSession(sandbox.path), {
        stage: 'all',
        skips: [],
        fix: false,
        isDryRun: false,
        noCache: true,
        only: ['structure/single-file-folder'],
    });
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
    const options = {
        stage: 'all' as const,
        skips: [],
        fix: false,
        isDryRun: false,
        noCache: true,
        only: ['structure/prefix-collisions'],
    };
    const initial = await executeRun(await openSession(sandbox.path), options);
    expect(initial.report.checks[0]?.findings).toMatchObject([
        { file: 'cards/asset-card.ts', rule: 'shared-prefix' },
        { file: 'mixed/turn.ts', rule: 'shared-prefix' },
    ]);
    expect(initial.report.checks[0]?.findings).toHaveLength(2);
    const allowed =
        policy +
        '[structure]\nprefix_collision_allowed = [{ paths = ["cards/**"], reason = "Required public names." }]\n';
    await Bun.write(join(sandbox.path, 'gspot.toml'), allowed);
    const retained = await executeRun(await openSession(sandbox.path), options);
    expect(retained.report.checks[0]?.findings).toMatchObject([{ file: 'mixed/turn.ts' }]);
    expect(retained.report.checks[0]?.findings).toHaveLength(1);
    await Bun.write(
        join(sandbox.path, 'gspot.toml'),
        allowed + '[limits]\nprefix_collisions = { value = 3, reason = "Required grouping threshold." }\n',
    );
    const raised = await executeRun(await openSession(sandbox.path), options);
    expect(raised.report.exitCode).toBe(0);
});

test.each([
    ['javascript', 'js'],
    ['typescript', 'ts'],
    ['swift', 'swift'],
    ['python', 'py'],
    ['react', 'jsx'],
    ['nextjs', 'tsx'],
    ['react-native', 'tsx'],
    ['nestjs', 'ts'],
    ['express', 'js'],
    ['vue', 'vue'],
    ['svelte', 'svelte'],
    ['fastapi', 'py'],
    ['xcode', 'swift'],
    ['xctest', 'swift'],
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
    const options = {
        stage: 'all' as const,
        skips: [],
        fix: false,
        isDryRun: false,
        noCache: true,
        only: ['structure/single-file-folder', 'structure/prefix-collisions'],
    };
    const initial = await executeRun(await openSession(sandbox.path), options);
    expect(initial.report.exitCode).toBe(1);
    expect(initial.report.checks.flatMap((check) => check.findings)).toMatchObject([
        { check: 'structure/single-file-folder', file: lone, line: 1, rule: 'lone-file' },
        { check: 'structure/prefix-collisions', file: card, line: 1, rule: 'shared-prefix' },
    ]);
    await Bun.write(join(sandbox.path, `feature/second.${extension}`), '');
    renameSync(join(sandbox.path, list), join(sandbox.path, `cards/other.${extension}`));
    const corrected = await executeRun(await openSession(sandbox.path), options);
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
        const options = {
            stage: 'all' as const,
            skips: [],
            fix: false,
            isDryRun: false,
            noCache: true,
            only: ['structure/prefix-collisions'],
        };
        const initial = await executeRun(await openSession(sandbox.path), options);
        expect(
            initial.report.checks[0]!.findings.map((finding) => finding.file).toSorted((left, right) =>
                left.localeCompare(right),
            ),
        ).toStrictEqual([paths[0]!, paths[2]!].toSorted((left, right) => left.localeCompare(right)));
        renameSync(join(sandbox.path, paths[1]!), join(sandbox.path, 'a\nb/other.ts'));
        renameSync(join(sandbox.path, paths[3]!), join(sandbox.path, 'a/other.ts'));
        commitAll(sandbox.path);
        const corrected = await executeRun(await openSession(sandbox.path), options);
        expect(corrected.report.exitCode).toBe(0);
        expect(corrected.report.checks[0]!.findings).toStrictEqual([]);
    });

test.each([
    ['jest', 'tests/support', ''],
    ['vitest', 'tests/helpers', ''],
    ['jest', 'tests/support', 'nested'],
    ['vitest', 'tests/helpers', 'nested'],
])('%s naming checks preserve the declared test harness directory', async (configuration, harness, scope) => {
    await using sandbox = await testdir();
    const prefix = scope === '' ? '' : `${scope}/`;
    const scopePolicy = scope === '' ? '' : `\n[[scope]]\npath = "${scope}"\nkits = []\n`;
    await createFileTree(sandbox.path, {
        'gspot.toml': policyOf(
            [configuration, 'typescript', 'naming'],
            `[tools.${configuration}]\nharness_directory = "${harness}"\n${scopePolicy}`,
            'all',
        ),
        [`${prefix}${harness}/startup.ts`]: '',
        [`${prefix}app/support/startup.ts`]: '',
    });
    const result = await executeRun(await openSession(sandbox.path), {
        stage: 'all',
        skips: [],
        fix: false,
        isDryRun: false,
        noCache: true,
        only: ['structure/folder-names', 'naming/paths'],
    });
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
    const result = await executeRun(await openSession(sandbox.path), {
        stage: 'commit',
        skips: [],
        fix: false,
        isDryRun: false,
        noCache: true,
        only: ['structure/single-file-folder', 'structure/prefix-collisions'],
    });
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
