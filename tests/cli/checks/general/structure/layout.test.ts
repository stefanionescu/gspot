import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { rename } from 'node:fs/promises';
import { commitAll } from '#tests/harness/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { executeRun } from '#cli/execution/public.ts';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { buildRunOptions } from '#tests/harness/gspot.ts';
import { isPosix } from '#tests/config/harness/platforms.ts';
import { ROUTE_CASES } from '#tests/config/cli/checks/general/structure/layout.ts';

test('folder checks count code files and preserve ignored and nested directories', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['typescript'], {
            tables: '[[ignore]]\ncheck = "structure/lone-files"\npaths = ["allowed/**", "parent/child/**"]\nreason = "Required entry directory."\n',
            level: 'all',
        }),
        'lone/only.ts': '',
        'typed/one.ts': '',
        'typed/one.d.ts': '',
        'module/one.mts': '',
        'module/one.d.mts': '',
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
        buildRunOptions({ only: ['structure/lone-files'] }),
    );
    expect(result.report.exitCode).toBe(1);
    expect(result.report.checks.flatMap((check) => check.findings.map((finding) => finding.file))).toStrictEqual([
        'dist/pkg/lone.ts',
        'lone/only.ts',
        'module/one.mts',
        'typed/one.ts',
    ]);
});

test('prefix checks group files and directories once and honor ignores and the threshold', async () => {
    const policy = buildPolicy(['typescript'], { level: 'all' });
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
        'paired/view.mts': '',
        'paired/view.d.mts': '',
        'paired/social.png': '',
        'paired/social.svg': '',
        // The package managers fix these names.
        'npm/package.json': '{}',
        'npm/package-lock.json': '{}',
        'pnpm/pnpm-lock.yaml': '',
        'pnpm/pnpm-workspace.yaml': '',
    });
    const options = buildRunOptions({ only: ['structure/prefix-collisions'] });
    const initial = await executeRun(await openSession(sandbox.path), options);
    expect(initial.report.checks[0]?.findings).toMatchObject([
        { file: 'cards/asset-card.ts', rule: 'shared-prefix' },
        { file: 'mixed/turn.ts', rule: 'shared-prefix' },
    ]);
    const allowed =
        policy +
        '[[ignore]]\ncheck = "structure/prefix-collisions"\npaths = ["cards/**"]\nreason = "Required public names."\n';
    await Bun.write(join(sandbox.path, 'gspot.toml'), allowed);
    const retained = await executeRun(await openSession(sandbox.path), options);
    expect(retained.report.checks[0]?.findings).toMatchObject([{ file: 'mixed/turn.ts' }]);
    await Bun.write(
        join(sandbox.path, 'gspot.toml'),
        allowed +
            '[limits]\nprefix_collisions = 3\n[reasons]\n"limits.prefix_collisions" = "Required grouping threshold."\n',
    );
    const raised = await executeRun(await openSession(sandbox.path), options);
    expect(raised.report.exitCode).toBe(0);
});

if (isPosix)
    test('prefix groups remain distinct when directory and prefix contain newlines', async () => {
        await using sandbox = await testdir();
        const paths = ['a\nb/c-one.ts', 'a\nb/c-two.ts', 'a/b\nc-one.ts', 'a/b\nc-two.ts'];
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['typescript'], { level: 'all' }),
            ...Object.fromEntries(paths.map((path) => [path, 'export const value = 1;\n'])),
        });
        commitAll(sandbox.path);
        const options = buildRunOptions({ only: ['structure/prefix-collisions'] });
        const initial = await executeRun(await openSession(sandbox.path), options);
        expect(
            initial.report.checks[0]!.findings.map((finding) => finding.file).toSorted((left, right) =>
                left.localeCompare(right),
            ),
        ).toStrictEqual([paths[0]!, paths[2]!].toSorted((left, right) => left.localeCompare(right)));
        await rename(join(sandbox.path, paths[1]!), join(sandbox.path, 'a\nb/other.ts'));
        await rename(join(sandbox.path, paths[3]!), join(sandbox.path, 'a/other.ts'));
        commitAll(sandbox.path);
        const corrected = await executeRun(await openSession(sandbox.path), options);
        expect(corrected.report.exitCode).toBe(0);
        expect(corrected.report.checks[0]!.findings).toStrictEqual([]);
    });

test.each(['', 'nested'])('naming checks leave the harness folder of scope %j alone', async (scope) => {
    await using sandbox = await testdir();
    const prefix = scope === '' ? '' : `${scope}/`;
    const scopePolicy =
        scope === ''
            ? ''
            : `\n[scope."${scope}"]\nconfigurations = []\n[scope."${scope}".architecture.roles]\ntest_harness = "tests/helpers"\n`;
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['typescript', 'naming'], {
            tables: `[architecture.roles]\ntest_harness = "tests/helpers"\n${scopePolicy}`,
            level: 'all',
        }),
        [`${prefix}tests/helpers/startup.ts`]: '',
        [`${prefix}app/support/startup.ts`]: '',
        [`${prefix}app/python/startup.ts`]: '',
    });
    const result = await executeRun(
        await openSession(sandbox.path),
        buildRunOptions({ only: ['structure/folder-names', 'naming/paths'] }),
    );
    expect(result.report.checks.flatMap((check) => check.findings)).toMatchObject([
        { check: 'naming/paths', file: `${prefix}app/support/startup.ts`, line: 1, rule: 'banned-term' },
        { check: 'structure/folder-names', file: `${prefix}app/support/startup.ts`, line: 1, rule: 'container-name' },
    ]);
});

test('structural checks classify output directories by ownership at all', async () => {
    await using sandbox = await testdir();
    const authored = Object.fromEntries(
        ['build', 'dist', 'coverage'].flatMap((directory) => [
            [`${directory}/lone/only.ts`, ''],
            [`${directory}/cards/asset-one.ts`, ''],
            [`${directory}/cards/asset-two.ts`, ''],
        ]),
    );
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['typescript'], {
            tables: '[[generated]]\npaths = ["emitted/**"]\nreason = "The compiler owns emitted files."\n',
            level: 'all',
        }),
        ...authored,
        'emitted/lone/only.ts': '',
        'emitted/cards/asset-one.ts': '',
        'emitted/cards/asset-two.ts': '',
    });
    const result = await executeRun(
        await openSession(sandbox.path),
        buildRunOptions({ stage: 'commit', only: ['structure/lone-files', 'structure/prefix-collisions'] }),
    );
    const findings = result.report.checks.flatMap((check) => check.findings);
    expect(findings.map(({ file }) => file).toSorted((left, right) => left.localeCompare(right))).toStrictEqual(
        ['build', 'dist', 'coverage']
            .flatMap((directory) => [`${directory}/lone/only.ts`, `${directory}/cards/asset-one.ts`])
            .toSorted((left, right) => left.localeCompare(right)),
    );
    expect(result.report.exitCode).toBe(1);
});

async function loneFiles(root: string): Promise<string[]> {
    const result = await executeRun(await openSession(root), buildRunOptions({ only: ['structure/lone-files'] }));
    return result.report.checks.flatMap((check) => check.findings.map((finding) => finding.file));
}

test.each(ROUTE_CASES)(
    '$framework $name route files need an explicit ignore and retain unignored neighbors',
    async ({ framework, name, directory, content }) => {
        await using sandbox = await testdir();
        const route = `${directory}/users/${name}`;
        const neighbor = `${directory}/teams/${name}`;
        const policy = buildPolicy(['typescript', framework], { level: 'all' });
        await createFileTree(sandbox.path, {
            'gspot.toml': policy,
            'package.json': '{"name":"example","private":true,"type":"module"}\n',
            [route]: content,
            [neighbor]: content,
        });
        expect(await loneFiles(sandbox.path)).toStrictEqual([neighbor, route]);
        await Bun.write(
            join(sandbox.path, 'gspot.toml'),
            policy +
                `[[ignore]]\ncheck = "structure/lone-files"\npaths = ["${route}"]\nreason = "The route file has the framework-required path."\n`,
        );
        expect(await loneFiles(sandbox.path)).toStrictEqual([neighbor]);
    },
);

test('path ignores exclude named prefix peers without hiding unrelated collisions', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['typescript'], {
            tables: '[[ignore]]\ncheck = "structure/prefix-collisions"\npaths = ["mise.toml", "mise.test.toml"]\nreason = "Mise selects these configuration file names."\n',
            level: 'all',
        }),
        'mise.toml': '',
        'mise.test.toml': '',
        'cards/asset-one.ts': '',
        'cards/asset-two.ts': '',
    });
    const result = await executeRun(
        await openSession(sandbox.path),
        buildRunOptions({ only: ['structure/prefix-collisions'] }),
    );
    expect(result.report.exitCode).toBe(1);
    expect(result.report.checks.flatMap((check) => check.findings)).toMatchObject([
        { file: 'cards/asset-one.ts', rule: 'shared-prefix' },
    ]);
});

test.each(['.githooks', '.husky', '.git-hooks', '.mise/tasks/hook'])(
    'prefix checks exempt scripts throughout %s and retain neighboring collisions',
    async (directory) => {
        await using sandbox = await testdir();
        const hooks = Object.fromEntries(
            [directory, `${directory}/nested`, `app/${directory}`, `app/${directory}/nested`].flatMap((path) =>
                ['post-merge', 'post-checkout', 'hook-first.ts', 'hook-second.ts'].map((name) => [
                    `${path}/${name}`,
                    name.endsWith('.ts') ? '' : '#!/bin/sh\nexit 0\n',
                ]),
            ),
        );
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['typescript'], {
                level: 'all',
                tables: '[scope."app"]\nconfigurations = ["typescript"]\n',
            }),
            ...hooks,
            [`${directory}-other/hook-first.ts`]: '',
            [`${directory}-other/hook-second.ts`]: '',
            [`app/${directory}-other/hook-first.ts`]: '',
            [`app/${directory}-other/hook-second.ts`]: '',
            'app/src/action-one.ts': '',
            'app/src/action-two.ts': '',
            'src/action-one.ts': '',
            'src/action-two.ts': '',
        });
        const result = await executeRun(
            await openSession(sandbox.path),
            buildRunOptions({ only: ['structure/prefix-collisions'] }),
        );
        expect(result.report.exitCode).toBe(1);
        expect(
            result.report.checks
                .flatMap((check) => check.findings.map(({ file }) => file))
                .toSorted((left, right) => left.localeCompare(right)),
        ).toStrictEqual(
            [
                `${directory}-other/hook-first.ts`,
                `app/${directory}-other/hook-first.ts`,
                'app/src/action-one.ts',
                'src/action-one.ts',
            ].toSorted((left, right) => left.localeCompare(right)),
        );
    },
);
