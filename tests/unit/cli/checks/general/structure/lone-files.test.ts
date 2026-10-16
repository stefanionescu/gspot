import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { commitAll } from '#tests/setup/git.ts';
import { executeRun } from '#cli/execution/run.ts';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/session.ts';
import { runCheckSample } from '#tests/setup/fixes.ts';
import { createSandbox } from '#tests/setup/sandbox.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { checkFindings } from '#tests/setup/check-input.ts';
import { buildRunOptions } from '#tests/setup/run-gspot.ts';
import { BASH_REPOSITORY } from '#tests/config/bash/sandbox.ts';
import { ROUTE_CASES, LONE_FILE_TREE, LONE_FILE_CASES } from '#tests/config/structure/folders.ts';

test('an untracked neighbor does not hide a selected tracked lone file', async () => {
    await using sandbox = await testdir({
        'gspot.toml': settingsText(['typescript'], { level: 'all' }),
        'lone/only.ts': LONE_FILE_TREE['lone/only.ts'],
    });
    commitAll(sandbox.path);
    await Bun.write(join(sandbox.path, 'lone/notes.txt'), 'Untracked notes.\n');
    expect(await checkFindings(sandbox.path, 'structure/lone-files', { paths: ['lone/only.ts'] })).toMatchObject([
        { file: 'lone/only.ts', rule: 'lone-file' },
    ]);
});

test('lone-files counts code files only and honors ignores and nested folders', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['typescript'], {
            tables: '[[ignore]]\ncheck = "structure/lone-files"\npaths = ["allowed/**", "parent/child/**"]\nreason = "Required entry directory."\n',
            level: 'all',
        }),
        ...LONE_FILE_TREE,
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
        'parent/main.ts',
        'typed/one.ts',
    ]);
});

test('build, dist and coverage folders are checked; folders marked linguist-generated in .gitattributes are not', async () => {
    await using sandbox = await testdir();
    const authored = Object.fromEntries(
        ['build', 'dist', 'coverage'].flatMap((directory) => [
            [`${directory}/lone/only.ts`, ''],
            [`${directory}/cards/asset-one.ts`, ''],
            [`${directory}/cards/asset-two.ts`, ''],
        ]),
    );
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['typescript'], {
            level: 'all',
        }),
        ...authored,
        '.gitattributes': 'emitted/** linguist-generated\n',
        'emitted/lone/only.ts': '',
        'emitted/cards/asset-one.ts': '',
        'emitted/cards/asset-two.ts': '',
    });
    commitAll(sandbox.path);
    const result = await executeRun(
        await openSession(sandbox.path),
        buildRunOptions({ stage: 'commit', only: ['structure/lone-files', 'structure/shared-prefixes'] }),
    );
    const findings = result.report.checks.flatMap((check) => check.findings);
    expect(findings.map(({ file }) => file).toSorted((left, right) => left.localeCompare(right))).toStrictEqual(
        ['build', 'dist', 'coverage']
            .flatMap((directory) => [`${directory}/lone/only.ts`, `${directory}/cards/asset-one.ts`])
            .toSorted((left, right) => left.localeCompare(right)),
    );
    expect(result.report.exitCode).toBe(1);
});

test.each([...ROUTE_CASES])(
    'a lone .astro or .svelte route file is reported when its framework is selected',
    async ({ framework, name, directory, content }) => {
        await using sandbox = await testdir();
        const route = `${directory}/users/${name}`;
        const neighbor = `${directory}/teams/${name}`;
        const settings = settingsText(['typescript', framework], { level: 'all' });
        await createFileTree(sandbox.path, {
            'gspot.toml': settings,
            'package.json': '{"name":"example","private":true,"type":"module"}\n',
            [route]: content,
            [neighbor]: content,
        });
        const result = await executeRun(
            await openSession(sandbox.path),
            buildRunOptions({ only: ['structure/lone-files'] }),
        );
        expect(result.report.checks.flatMap((check) => check.findings.map((finding) => finding.file))).toStrictEqual([
            neighbor,
            route,
        ]);
    },
);

for (const entry of LONE_FILE_CASES) {
    test(entry.check + ' reports ' + entry.expected.rule + ' and passes after the fix', async () => {
        await using sandbox = await createSandbox(BASH_REPOSITORY);
        await runCheckSample(sandbox, entry, BASH_REPOSITORY);
    });
}
