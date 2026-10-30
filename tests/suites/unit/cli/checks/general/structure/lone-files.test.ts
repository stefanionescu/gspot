import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { compareText } from '#cli/system/text.ts';
import { testdir, createFileTree } from 'testdirs';
import { runChecks } from '#cli/commands/check/run.ts';
import { openSession } from '#cli/planning/session.ts';
import { commitAll } from '#tests/setup/system/git.ts';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { LINGUIST_GENERATED_PATTERN } from '#tests/config/git.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';

import {
    LONE_FILE_TREE,
    LONE_CODE_FILES,
    ROUTE_FILE_CASES,
    FRAMEWORK_COMPONENT_CASES,
} from '#tests/config/checks/general/structure/lone-files.ts';

test('an untracked neighbor does not hide a selected tracked lone file', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['typescript'], { level: 'all' }),
        'lone/only.ts': LONE_FILE_TREE['lone/only.ts'],
    });
    commitAll(sandbox.path);
    await writeFile(join(sandbox.path, 'lone/notes.txt'), 'Untracked notes.\n');
    expect(await runSandboxCheck(sandbox.path, 'structure/lone-files', { paths: ['lone/only.ts'] })).toMatchObject([
        { file: 'lone/only.ts', rule: 'lone-file' },
    ]);
});

test('only code files count, and ignored paths and folders with subfolders are not reported', async () => {
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
        ...LONE_CODE_FILES,
    ]);
});

test('lone-files and shared-prefixes check build, dist and coverage folders and skip folders marked linguist-generated', async () => {
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
        '.gitattributes': LINGUIST_GENERATED_PATTERN,
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
    expect(findings.map(({ file }) => file).toSorted(compareText)).toStrictEqual(
        ['build', 'dist', 'coverage']
            .flatMap((folder) => [`${folder}/lone/only.ts`, `${folder}/cards/asset-one.ts`])
            .toSorted(compareText),
    );
});

test.each([...FRAMEWORK_COMPONENT_CASES])(
    'a lone $framework component is reported once its framework is selected',
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
        const findings = await runSandboxCheck(sandbox.path, 'structure/lone-files');
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
        const findings = await runSandboxCheck(sandbox.path, 'structure/lone-files');
        expect(findings.map(({ file, rule }) => ({ file, rule }))).toStrictEqual([
            { file: expected, rule: 'lone-file' },
        ]);
    },
);
