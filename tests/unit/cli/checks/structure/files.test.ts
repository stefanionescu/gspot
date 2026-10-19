import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { runChecks } from '#cli/runs/run.ts';
import { openSession } from '#cli/session.ts';
import { commitAll } from '#tests/setup/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { createSandbox } from '#tests/setup/sandbox.ts';
import { buildRunOptions } from '#tests/setup/builders.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { BASH_SANDBOX } from '#tests/data/checks/bash/samples.ts';
import { checkLongFiles } from '#cli/checks/structure/long-files.ts';
import { LONG_PYTHON_FILE } from '#tests/data/checks/python/modules.ts';
import { checkFindings, buildCheckInput } from '#tests/setup/check-input.ts';
import { runCheckSample, expectedSummary, summarizeSample } from '#tests/setup/sample-checks.ts';
import { ROUTE_CASES, LONE_FILE_TREE, FILE_FOLDER_CLASH_CASES } from '#tests/data/checks/structure/folders.ts';

test.each([...FILE_FOLDER_CLASH_CASES])(
    'file-folder-clashes: $check reports $expected.rule and passes after the fix',
    async (entry) => {
        await using sandbox = await createSandbox(BASH_SANDBOX);
        const result = await runCheckSample(sandbox, entry, BASH_SANDBOX);
        expect(summarizeSample(result)).toStrictEqual(expectedSummary(entry));
    },
);
test.each(['.sh', '.bats', ''])(
    'file-lines: Bash %s heredocs and multiline strings count as code lines',
    async (extension) => {
        const source = '#!/bin/sh\n# comment\ncat <<\'EOF\'\n# literal\nEOF\nvalue="first\n# literal\nlast"\n';
        const file = `run${extension}`;
        await using sandbox = await testdir({
            'gspot.toml': buildSettingsText(['bash'], { level: 'all', tables: '[limits.bash]\nfile_lines = 5\n' }),
            [file]: source,
        });
        const found = await checkLongFiles(buildCheckInput(await openSession(sandbox.path), 'structure/long-files'));
        expect(found).toMatchObject([
            { file, line: 1, rule: 'file-lines', message: 'This file has 6 code lines, over the limit of 5.' },
        ]);
        await Bun.write(join(sandbox.path, file), source.replace('# literal\nEOF', 'EOF'));
        expect(
            await checkLongFiles(buildCheckInput(await openSession(sandbox.path), 'structure/long-files')),
        ).toStrictEqual([]);
    },
);

test('file-lines: Python files count each executable line against the declared limit', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSettingsText(['python'], { level: 'all', tables: '[limits]\nfile_lines = 12\n' }),
        'example/big.py': `"""A test module."""\n\n\n${LONG_PYTHON_FILE}\n`,
    });
    expect(
        await checkLongFiles(buildCheckInput(await openSession(sandbox.path), 'structure/long-files')),
    ).toMatchObject([{ file: 'example/big.py', rule: 'file-lines', line: 1 }]);
});
test('lone-files: an untracked neighbor does not hide a selected tracked lone file', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSettingsText(['typescript'], { level: 'all' }),
        'lone/only.ts': LONE_FILE_TREE['lone/only.ts'],
    });
    commitAll(sandbox.path);
    await Bun.write(join(sandbox.path, 'lone/notes.txt'), 'Untracked notes.\n');
    expect(await checkFindings(sandbox.path, 'structure/lone-files', { paths: ['lone/only.ts'] })).toMatchObject([
        { file: 'lone/only.ts', rule: 'lone-file' },
    ]);
});

test('lone-files: lone-files counts code files only and honors ignores and nested folders', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSettingsText(['typescript'], {
            tables: '[[ignore]]\ncheck = "structure/lone-files"\npaths = ["allowed/**", "parent/child/**"]\nreason = "Required entry directory."\n',
            level: 'all',
        }),
        ...LONE_FILE_TREE,
    });
    const result = await runChecks(
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
        'gspot.toml': buildSettingsText(['typescript'], {
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
    expect(result.report.exitCode).toBe(1);
});

test.each([...ROUTE_CASES])(
    'lone-files: a lone .astro page or .svelte component is reported when its framework is selected',
    async ({ framework, name, folder, content }) => {
        await using sandbox = await testdir();
        const route = `${folder}/users/${name}`;
        const neighbor = `${folder}/teams/${name}`;
        const settings = buildSettingsText(['typescript', framework], { level: 'all' });
        await createFileTree(sandbox.path, {
            'gspot.toml': settings,
            'package.json': '{"name":"example","private":true,"type":"module"}\n',
            [route]: content,
            [neighbor]: content,
        });
        const result = await runChecks(
            await openSession(sandbox.path),
            buildRunOptions({ only: ['structure/lone-files'] }),
        );
        expect(result.report.checks.flatMap((check) => check.findings.map((finding) => finding.file))).toStrictEqual([
            neighbor,
            route,
        ]);
    },
);

test('lone-files: a folder with only a Next.js route file is a route, not a lone file', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSettingsText(['typescript', 'react', 'react-dom', 'nextjs'], { level: 'all' }),
        'app/about/page.tsx': 'export default function About() { return null; }\n',
        'app/api/health/route.ts': 'export function GET() { return new Response("ok"); }\n',
        'app/lone/widget.tsx': 'export const widget = 1;\n',
    });
    const findings = await checkFindings(sandbox.path, 'structure/lone-files');
    expect(findings.map(({ file, rule }) => ({ file, rule }))).toStrictEqual([
        { file: 'app/lone/widget.tsx', rule: 'lone-file' },
    ]);
});

test('lone-files: a folder with only a SvelteKit route file is a route, not a lone file', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSettingsText(['typescript', 'svelte'], { level: 'all' }),
        'package.json': '{"name":"example","private":true,"type":"module"}\n',
        'src/routes/users/+page.svelte': '<p>Users</p>\n',
        'src/routes/api/+server.ts': 'export function GET() { return new Response("ok"); }\n',
        'src/lib/cards/Card.svelte': '<p>Card</p>\n',
    });
    const findings = await checkFindings(sandbox.path, 'structure/lone-files');
    expect(findings.map(({ file, rule }) => ({ file, rule }))).toStrictEqual([
        { file: 'src/lib/cards/Card.svelte', rule: 'lone-file' },
    ]);
});
