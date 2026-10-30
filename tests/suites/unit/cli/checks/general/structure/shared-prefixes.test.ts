import { test, expect } from 'bun:test';
import { join, posix } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { compareText } from '#cli/system/text.ts';
import { testdir, createFileTree } from 'testdirs';
import { runChecks } from '#cli/commands/check/run.ts';
import { openSession } from '#cli/planning/session.ts';
import { commitAll } from '#tests/setup/system/git.ts';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { isWindows } from '#tests/setup/system/platform.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';

import {
    PREFIX_TREE,
    NEST_SUFFIX_FILES,
    NESTJS_PREFIX_RESULTS,
} from '#tests/config/checks/general/structure/structure.ts';

test('shared-prefixes groups files and folders once, and honors an ignore and a raised limit', async () => {
    const settings = buildSandboxSettings(['typescript'], { level: 'all' });
    await using sandbox = await testdir({
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
    await writeFile(join(sandbox.path, 'gspot.toml'), allowed);
    const kept = await runChecks(await openSession(sandbox.path), options);
    expect(kept.report.checks[0]?.findings).toMatchObject([{ file: 'mixed/turn.ts' }]);
    await writeFile(
        join(sandbox.path, 'gspot.toml'),
        allowed + '[limits]\nshared_prefix_files = { value = 3, reason = "Required grouping limit." }\n',
    );
    const raised = await runChecks(await openSession(sandbox.path), options);
    expect(raised.report.failed).toStrictEqual([]);
});

test.skipIf(isWindows)('prefix groups stay apart when folder and file names contain line breaks', async () => {
    await using sandbox = await testdir();
    const paths = ['a\nb/c-one.ts', 'a\nb/c-two.ts', 'a/b\nc-one.ts', 'a/b\nc-two.ts'];
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings(['typescript'], { level: 'all' }),
        ...Object.fromEntries(paths.map((path) => [path, 'export const value = 1;\n'])),
    });
    commitAll(sandbox.path);
    const initial = await runSandboxCheck(sandbox.path, 'structure/shared-prefixes');
    expect(initial.map((finding) => finding.file).toSorted(compareText)).toStrictEqual(
        [paths[0]!, paths[2]!].toSorted(compareText),
    );
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
        'gspot.toml': buildSandboxSettings(['typescript'], {
            level: 'all',
            scopes: [{ path: 'app', configurations: ['typescript'] }],
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

    expect(
        result.report.checks.flatMap((check) => check.findings.map(({ file }) => file)).toSorted(compareText),
    ).toStrictEqual(
        [
            `${folder}-other/hook-first.ts`,
            `app/${folder}-other/hook-first.ts`,
            'app/src/action-one.ts',
            'src/action-one.ts',
        ].toSorted(compareText),
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
        'gspot.toml': buildSandboxSettings(['typescript'], {
            level: 'all',
            scopes: [{ path: 'app', configurations: ['nestjs'] }, { path: 'app/deep' }, { path: 'sibling' }],
        }),
        ...NEST_SUFFIX_FILES,
    });
    const result = await runChecks(
        await openSession(sandbox.path),
        buildRunOptions({ only: ['structure/shared-prefixes'] }),
    );
    expect(
        result.report.checks.map(({ scope, findings }) => ({ scope, paths: findings.map(({ file }) => file) })),
    ).toStrictEqual([...NESTJS_PREFIX_RESULTS]);
});

test('snake_case and PascalCase siblings share their first word', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['typescript'], { level: 'all' }),
        'snake/invoice_list.ts': '',
        'snake/invoice_row.ts': '',
        'pascal/InvoiceList.ts': '',
        'pascal/InvoiceRow.ts': '',
    });
    const findings = await runSandboxCheck(sandbox.path, 'structure/shared-prefixes');
    expect(findings.map(({ file, rule }) => ({ file, rule }))).toStrictEqual([
        { file: 'pascal/InvoiceList.ts', rule: 'shared-prefix' },
        { file: 'snake/invoice_list.ts', rule: 'shared-prefix' },
    ]);
});
