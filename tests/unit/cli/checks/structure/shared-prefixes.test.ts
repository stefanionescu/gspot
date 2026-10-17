import { test, expect } from 'bun:test';
import { join, posix } from 'node:path';
import { openSession } from '#cli/session.ts';
import { commitAll } from '#tests/setup/git.ts';
import { runChecks } from '#cli/checks/run/run.ts';
import { isWindows } from '#tests/setup/system.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildRunOptions } from '#tests/setup/builders.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { PREFIX_TREE } from '#tests/data/checks/structure/folders.ts';

test('prefix checks group files and directories once and honor ignores and the limit', async () => {
    const settings = buildSettingsText(['typescript'], { level: 'all' });
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settings,
        ...PREFIX_TREE,
    });
    const options = buildRunOptions({ only: ['structure/shared-prefixes'] });
    const initial = await runChecks(await openSession(sandbox.path), options);
    expect(initial.report.checks[0]?.findings).toMatchObject([
        { file: 'cards/asset-card.ts', rule: 'shared-prefix' },
        { file: 'mixed/turn.ts', rule: 'shared-prefix' },
    ]);
    const allowed =
        settings +
        '[[ignore]]\ncheck = "structure/shared-prefixes"\npaths = ["cards/**"]\nreason = "Required public names."\n';
    await Bun.write(join(sandbox.path, 'gspot.toml'), allowed);
    const retained = await runChecks(await openSession(sandbox.path), options);
    expect(retained.report.checks[0]?.findings).toMatchObject([{ file: 'mixed/turn.ts' }]);
    await Bun.write(
        join(sandbox.path, 'gspot.toml'),
        allowed + '[limits]\nshared_prefix_files = { value = 3, reason = "Required grouping limit." }\n',
    );
    const raised = await runChecks(await openSession(sandbox.path), options);
    expect(raised.report.exitCode).toBe(0);
});

// Windows file names cannot contain line breaks.
test.skipIf(isWindows)('prefix groups stay apart when folder and file names contain line breaks', async () => {
    await using sandbox = await testdir();
    const paths = ['a\nb/c-one.ts', 'a\nb/c-two.ts', 'a/b\nc-one.ts', 'a/b\nc-two.ts'];
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSettingsText(['typescript'], { level: 'all' }),
        ...Object.fromEntries(paths.map((path) => [path, 'export const value = 1;\n'])),
    });
    commitAll(sandbox.path);
    const options = buildRunOptions({ only: ['structure/shared-prefixes'] });
    const initial = await runChecks(await openSession(sandbox.path), options);
    expect(
        initial.report.checks[0]!.findings.map((finding) => finding.file).toSorted((left, right) =>
            left.localeCompare(right),
        ),
    ).toStrictEqual([paths[0]!, paths[2]!].toSorted((left, right) => left.localeCompare(right)));
});

test('hook scripts under .husky do not count; other files beside them still do', async () => {
    const folder = '.husky';
    await using sandbox = await testdir();
    const hooks = Object.fromEntries(
        [folder, `${folder}/nested`, `app/${folder}`, `app/${folder}/nested`].flatMap((path) =>
            ['post-merge', 'post-checkout', 'hook-first.ts', 'hook-second.ts'].map((name) => [
                `${path}/${name}`,
                name.endsWith('.ts') ? '' : '#!/bin/sh\nexit 0\n',
            ]),
        ),
    );
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSettingsText(['typescript'], {
            level: 'all',
            tables: '[[scope]]\npath = "app"\nconfigurations = ["typescript"]\n',
        }),
        ...hooks,
        [`${folder}-other/hook-first.ts`]: '',
        [`${folder}-other/hook-second.ts`]: '',
        [`app/${folder}-other/hook-first.ts`]: '',
        [`app/${folder}-other/hook-second.ts`]: '',
        'app/src/action-one.ts': '',
        'app/src/action-two.ts': '',
        'src/action-one.ts': '',
        'src/action-two.ts': '',
    });
    const result = await runChecks(
        await openSession(sandbox.path),
        buildRunOptions({ only: ['structure/shared-prefixes'] }),
    );
    expect(result.report.exitCode).toBe(1);
    expect(
        result.report.checks
            .flatMap((check) => check.findings.map(({ file }) => file))
            .toSorted((left, right) => left.localeCompare(right)),
    ).toStrictEqual(
        [
            `${folder}-other/hook-first.ts`,
            `app/${folder}-other/hook-first.ts`,
            'app/src/action-one.ts',
            'src/action-one.ts',
        ].toSorted((left, right) => left.localeCompare(right)),
    );
});

test('NestJS kind suffixes do not count in NestJS scopes; JSX files and unknown kinds still do', async () => {
    await using sandbox = await testdir();
    const sourceFiles: Record<string, string> = {};
    for (const scope of ['', 'app', 'app/deep', 'sibling']) {
        for (const kind of ['controller', 'service']) {
            for (const suffix of ['ts', 'spec.ts']) sourceFiles[posix.join(scope, `feature.${kind}.${suffix}`)] = '';
        }
    }
    await createFileTree(sandbox.path, {
        ...sourceFiles,
        'gspot.toml': buildSettingsText(['typescript'], {
            level: 'all',
            tables: '[[scope]]\npath = "app"\nconfigurations = ["nestjs"]\n[[scope]]\npath = "app/deep"\n[[scope]]\npath = "sibling"\n',
        }),
        'app/jsx.view.tsx': '',
        'app/jsx.service.tsx': '',
        'app/jsx.controller.tsx': '',
        'app/custom.one.ts': '',
        'app/custom.two.ts': '',
        'app/custom.three.ts': '',
    });
    const result = await runChecks(
        await openSession(sandbox.path),
        buildRunOptions({ only: ['structure/shared-prefixes'] }),
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
