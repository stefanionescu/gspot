import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { openSession } from '#cli/session.ts';
import { commitAll } from '#tests/setup/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { runChecks } from '#cli/commands/check/run.ts';
import { createSandbox } from '#tests/setup/sandbox.ts';
import { buildRunOptions } from '#tests/setup/builders.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { BASH_SANDBOX } from '#tests/data/checks/bash/samples.ts';
import { LONG_PYTHON_FILE } from '#tests/data/checks/python/modules.ts';
import { checkFindings, findBuiltInCheck, planSandboxCheck } from '#tests/setup/check-input.ts';
import { runCheckSample, expectedSummary, buildSampleSummary } from '#tests/setup/sample-checks.ts';

import {
    ROUTE_CASES,
    LONE_FILE_TREE,
    ROUTE_FILE_CASES,
    FILE_FOLDER_CLASH_CASES,
} from '#tests/data/checks/structure/folders.ts';

test.each([...FILE_FOLDER_CLASH_CASES])(
    'file-folder-clashes: $check reports $expected.rule and passes after the fix',
    async (entry) => {
        await using sandbox = await createSandbox(BASH_SANDBOX);
        const result = await runCheckSample(sandbox, entry, BASH_SANDBOX);
        expect(buildSampleSummary(result)).toStrictEqual(expectedSummary(entry));
    },
);
test.each(['.sh', '.bats', ''])(
    'file-lines: Bash %s heredocs and multiline strings count as code lines',
    async (extension) => {
        const source = '#!/bin/sh\n# comment\ncat <<\'EOF\'\n# literal\nEOF\nvalue="first\n# literal\nlast"\n';
        const file = `run${extension}`;
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['bash'], { level: 'all', tables: '[limits.bash]\nfile_lines = 5\n' }),
            [file]: source,
        });
        const session = await openSession(sandbox.path);
        const found = await findBuiltInCheck('structure/long-files')(
            session,
            planSandboxCheck(session, 'structure/long-files'),
        );
        expect(found).toMatchObject([
            { file, line: 1, rule: 'file-lines', message: 'This file has 6 code lines, over the limit of 5.' },
        ]);
        await writeFile(join(sandbox.path, file), source.replace('# literal\nEOF', 'EOF'));
        const checkedSession = await openSession(sandbox.path);
        expect(
            await findBuiltInCheck('structure/long-files')(
                checkedSession,
                planSandboxCheck(checkedSession, 'structure/long-files'),
            ),
        ).toStrictEqual([]);
    },
);

test('file-lines: Python files count each executable line against the declared limit', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['python'], { level: 'all', tables: '[limits]\nfile_lines = 12\n' }),
        'example/big.py': `"""A test module."""\n\n\n${LONG_PYTHON_FILE}\n`,
    });
    const session = await openSession(sandbox.path);
    expect(
        await findBuiltInCheck('structure/long-files')(session, planSandboxCheck(session, 'structure/long-files')),
    ).toMatchObject([{ file: 'example/big.py', rule: 'file-lines', line: 1 }]);
});
test('lone-files: an untracked neighbor does not hide a selected tracked lone file', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['typescript'], { level: 'all' }),
        'lone/only.ts': LONE_FILE_TREE['lone/only.ts'],
    });
    commitAll(sandbox.path);
    await writeFile(join(sandbox.path, 'lone/notes.txt'), 'Untracked notes.\n');
    expect(await checkFindings(sandbox.path, 'structure/lone-files', { paths: ['lone/only.ts'] })).toMatchObject([
        { file: 'lone/only.ts', rule: 'lone-file' },
    ]);
});

test('lone-files: lone-files counts code files only and honors ignores and nested folders', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['typescript'], {
            tables: '[[ignore]]\ncheck = "structure/lone-files"\npaths = ["allowed/**", "parent/child/**"]\nreason = "Required entry directory."\n',
            level: 'all',
        }),
        ...LONE_FILE_TREE,
    });

    const result = await runChecks(
        await openSession(sandbox.path),
        buildRunOptions({ only: ['structure/lone-files'] }),
    );

    expect(result.report.checks.flatMap((check) => check.findings.map((finding) => finding.file))).toStrictEqual([
        'dist/pkg/lone.ts',
        'lone/only.ts',
        'module/one.mts',
        'parent/main.ts',
        'typed/one.ts',
    ]);
});

test('lone-files: build, dist and coverage folders are checked; folders marked linguist-generated in .gitattributes are not', async () => {
    await using sandbox = await testdir();
    const authored = Object.fromEntries(
        ['build', 'dist', 'coverage'].flatMap((folder) => [
            [`${folder}/lone/only.ts`, ''],
            [`${folder}/cards/asset-one.ts`, ''],
            [`${folder}/cards/asset-two.ts`, ''],
        ]),
    );
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings(['typescript'], {
            level: 'all',
        }),
        ...authored,
        '.gitattributes': 'emitted/** linguist-generated\n',
        'emitted/lone/only.ts': '',
        'emitted/cards/asset-one.ts': '',
        'emitted/cards/asset-two.ts': '',
    });
    commitAll(sandbox.path);
    const result = await runChecks(
        await openSession(sandbox.path),
        buildRunOptions({ stage: 'commit', only: ['structure/lone-files', 'structure/shared-prefixes'] }),
    );
    const findings = result.report.checks.flatMap((check) => check.findings);
    expect(findings.map(({ file }) => file).toSorted((left, right) => left.localeCompare(right))).toStrictEqual(
        ['build', 'dist', 'coverage']
            .flatMap((folder) => [`${folder}/lone/only.ts`, `${folder}/cards/asset-one.ts`])
            .toSorted((left, right) => left.localeCompare(right)),
    );
});

test.each([...ROUTE_CASES])(
    'lone-files: a lone .astro page or .svelte component is reported when its framework is selected',
    async ({ framework, name, folder, content }) => {
        await using sandbox = await testdir();
        const route = `${folder}/users/${name}`;
        const neighbor = `${folder}/teams/${name}`;
        const settings = buildSandboxSettings(['typescript', framework], { level: 'all' });
        await createFileTree(sandbox.path, {
            'gspot.toml': settings,
            'package.json': '{"name":"example","private":true,"type":"module"}\n',
            [route]: content,
            [neighbor]: content,
        });
        const findings = await checkFindings(sandbox.path, 'structure/lone-files');
        expect(findings.map((finding) => finding.file)).toStrictEqual([neighbor, route]);
    },
);

test.each([...ROUTE_FILE_CASES])(
    'a folder with only a $framework route file is a route, not a lone file',
    async ({ configurations, files, expected }) => {
        await using sandbox = await testdir({
            ...files,
            'gspot.toml': buildSandboxSettings([...configurations], { level: 'all' }),
        });
        const findings = await checkFindings(sandbox.path, 'structure/lone-files');
        expect(findings.map(({ file, rule }) => ({ file, rule }))).toStrictEqual([
            { file: expected, rule: 'lone-file' },
        ]);
    },
);
