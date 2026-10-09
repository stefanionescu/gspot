import { test, expect } from 'bun:test';
import { join, posix } from 'node:path';
import { commitAll } from '#tests/harness/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/public.ts';
import { executeRun } from '#cli/execution/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { buildRunOptions } from '#tests/harness/gspot.ts';
import { isPosix } from '#tests/config/harness/platforms.ts';
import { NESTJS_KIND_CASES, PREFIX_OWNER_CASES } from '#tests/config/cli/checks/general/structure/prefix-collisions.ts';

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

test.skipIf(!isPosix)('prefix groups remain distinct when directory and prefix contain newlines', async () => {
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
});

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

test.each(PREFIX_OWNER_CASES)(
    '$prefix exemption follows selected $configuration scopes',
    async ({ prefix, configuration, siblingPaths }) => {
        await using sandbox = await testdir();
        const sourceFiles = Object.fromEntries(
            ['', 'app', 'app/deep', 'sibling'].flatMap((scope) =>
                ['one', 'two', 'three'].map((name) => [posix.join(scope, `${prefix}-${name}.py`), '']),
            ),
        );
        const policy = buildPolicy(['python', configuration], {
            level: 'all',
            tables: `[scope.app]\n[scope."app/deep"]\n[scope.sibling]\nremoved_configurations = [${JSON.stringify(configuration)}]\n`,
        });
        await createFileTree(sandbox.path, { ...sourceFiles, 'gspot.toml': policy });
        const result = await executeRun(
            await openSession(sandbox.path),
            buildRunOptions({ only: ['structure/prefix-collisions'] }),
        );
        expect(
            result.report.checks.map(({ scope, findings }) => ({ scope, paths: findings.map(({ file }) => file) })),
        ).toStrictEqual([
            { scope: '', paths: [] },
            { scope: 'app', paths: [] },
            { scope: 'app/deep', paths: [] },
            { scope: 'sibling', paths: siblingPaths },
        ]);
        await Bun.write(join(sandbox.path, 'gspot.toml'), policy.replace('level = "all"', 'level = "recommended"'));
        const recommended = await executeRun(
            await openSession(sandbox.path),
            buildRunOptions({ only: ['structure/prefix-collisions'] }),
        );
        expect(recommended.report.checks).toStrictEqual([]);
    },
);

test('all NestJS declaration kinds and spec suffixes follow scope ownership while JSX and unknown kinds still collide', async () => {
    await using sandbox = await testdir();
    const sourceFiles: Record<string, string> = {};
    for (const scope of ['', 'app', 'app/deep', 'sibling'])
        for (const kind of NESTJS_KIND_CASES)
            for (const suffix of ['ts', 'spec.ts']) sourceFiles[posix.join(scope, `feature.${kind}.${suffix}`)] = '';
    await createFileTree(sandbox.path, {
        ...sourceFiles,
        'gspot.toml': buildPolicy(['typescript'], {
            level: 'all',
            tables: '[scope.app]\nconfigurations = ["nestjs"]\n[scope."app/deep"]\n[scope.sibling]\n',
        }),
        'app/jsx.view.tsx': '',
        'app/jsx.service.tsx': '',
        'app/jsx.controller.tsx': '',
        'app/custom.one.ts': '',
        'app/custom.two.ts': '',
        'app/custom.three.ts': '',
    });
    const result = await executeRun(
        await openSession(sandbox.path),
        buildRunOptions({ only: ['structure/prefix-collisions'] }),
    );
    expect(
        result.report.checks.map(({ scope, findings }) => ({ scope, paths: findings.map(({ file }) => file) })),
    ).toStrictEqual([
        { scope: '', paths: ['feature.controller.spec.ts'] },
        { scope: 'app', paths: ['app/custom.one.ts', 'app/jsx.controller.tsx'] },
        { scope: 'app/deep', paths: [] },
        { scope: 'sibling', paths: ['sibling/feature.controller.spec.ts'] },
    ]);
});
