import { writeFile } from 'node:fs/promises';
import { join, posix } from 'node:path';

import { expect, test } from 'bun:test';
import { createFileTree } from 'testdirs';

import { runChecks } from '#cli/engine/run.ts';
import { openSession } from '#cli/engine/session.ts';
import { compareText } from '#cli/system/text.ts';
import { NEST_SUFFIX_FILES, NESTJS_PREFIX_RESULTS, PREFIX_TREE } from '#tests/config/configurations/structure/files.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildRunOptions } from '#tests/setup/cli/run.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test("shared-prefixes and file-folder-clashes leave gspot's own file names out", async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['typescript'], { level: 'all' }),
        'gspot/index.ts': 'export const name = "gspot";\n',
    });
    expect(await runSandboxCheck(sandbox.path, 'structure/shared-prefixes')).toStrictEqual([]);
    expect(await runSandboxCheck(sandbox.path, 'structure/file-folder-clashes')).toStrictEqual([]);
});

test('shared-prefixes leaves out the test_ prefix that pytest requires', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['pytest'], { level: 'all' }),
        'tests/test_first.py': '',
        'tests/test_second.py': '',
        'tests/test_third.py': '',
    });
    expect(await runSandboxCheck(sandbox.path, 'structure/shared-prefixes')).toStrictEqual([]);
});

test('shared-prefixes groups files and folders once, and honors an ignore and a raised limit', async () => {
    const settings = buildSandboxSettings(['typescript'], { level: 'all' });
    await using sandbox = await createGitSandbox({
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
        allowed + '[limits]\nmin_shared_prefix_files = { value = 3, reason = "Required grouping limit." }\n',
    );
    const raised = await runChecks(await openSession(sandbox.path), options);
    expect(raised.report.failed).toStrictEqual([]);
});

test('hook scripts under .husky do not count; other files beside them still do', async () => {
    const folder = '.husky';
    await using sandbox = await createGitSandbox({});
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
    await using sandbox = await createGitSandbox({});
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

test('a file that the filters drop carries no finding of the group beside it', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['typescript'], {
            level: 'all',
            scopes: [{ path: 'app', configurations: ['nestjs'] }],
        }),
        'app/user.service.ts': '',
        'app/user-list.ts': '',
        'app/user-row.ts': '',
    });
    const findings = await runSandboxCheck(sandbox.path, 'structure/shared-prefixes', { scope: 'app' });
    expect(findings.map(({ file }) => file)).toStrictEqual(['app/user-list.ts']);
});

test('a folder that carries the prefix as its name and Swift files named after their types report nothing', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['typescript', 'swift'], { level: 'all' }),
        'invoice/invoice-list.ts': '',
        'invoice/invoice-row.ts': '',
        'Sources/InvoiceList.swift': '',
        'Sources/InvoiceRow.swift': '',
    });
    expect(await runSandboxCheck(sandbox.path, 'structure/shared-prefixes')).toStrictEqual([]);
});

test('snake_case and PascalCase siblings share their first word', async () => {
    await using sandbox = await createGitSandbox({
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
