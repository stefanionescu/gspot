import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { stringify } from '@decimalturn/toml-patch';
import { commitAll } from '#tests/setup/system/git.ts';
import { buildEslint } from '#tests/setup/eslint/lint.ts';
import { TERMS_SOURCE } from '#tests/config/typescript.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { UNMATCHED_PATH_CASES } from '#tests/config/checks/general/gspot/gspot.ts';

test.each([...UNMATCHED_PATH_CASES])(
    'gspot/unmatched-paths reports each setting path without a tracked match: $name',
    async ({ files, settings, messages }) => {
        await using sandbox = await testdir();
        const { configurations, ...tables } = settings;
        await createFileTree(sandbox.path, {
            ...files,
            'gspot.toml': buildSandboxSettings(configurations, {
                level: 'all',
                rules: true,
                tables: stringify(tables),
            }),
        });
        commitAll(sandbox.path);
        const findings = await runSandboxCheck(sandbox.path, 'gspot/unmatched-paths');
        expect(findings.map((finding) => finding.message)).toStrictEqual([...messages]);
        expect(findings).toMatchObject(
            messages.map(() => ({ check: 'gspot/unmatched-paths', file: 'gspot.toml', rule: 'unmatched-path' })),
        );
    },
);

test('an unmatched ignore path with an unescaped route group gets help to escape its brackets', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['typescript'], {
            tables: '[[ignore]]\ncheck = "structure/lone-files"\npaths = ["app/(missing)/**"]\nreason = "A route group."\n',
        }),
        'app/(legal)/terms/page.tsx': TERMS_SOURCE,
    });
    commitAll(sandbox.path);
    const unmatched = await runSandboxCheck(sandbox.path, 'gspot/unmatched-paths');
    expect(unmatched.map(({ message }) => message)).toStrictEqual([
        String.raw`app/(missing)/** under [[ignore]] matches no tracked file or folder. If a folder name holds ( ) [ ], escape each with a backslash in a TOML literal string, such as 'app/\(legal\)/**'.`,
    ]);
});

test('an unmatched ignore points at its written record', async () => {
    const text = buildSandboxSettings([], {
        tables: '\n[[ignore]]\npaths = ["missing/**"]\nreason = "This sample names an absent folder."\n',
    });
    await using sandbox = await testdir({ 'gspot.toml': text });
    commitAll(sandbox.path);
    const findings = await runSandboxCheck(sandbox.path, 'gspot/unmatched-paths');
    expect(findings).toMatchObject([{ file: 'gspot.toml', line: text.split('\n').indexOf('[[ignore]]') + 1 }]);
});

test('a missing scope with rule options leaves apply usable and unmatched paths reports the typo', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript'], {
            tables: '[[scope]]\npath = "missing"\ntools.eslint.rules = { eqeqeq = ["always"] }\n',
        }),
        'source.js': 'export const ready = true;\n',
    });
    await buildEslint(sandbox.path);
    expect(await runSandboxCheck(sandbox.path, 'gspot/unmatched-paths')).toMatchObject([
        { file: 'gspot.toml', message: 'missing under scope.0.path matches no tracked file or folder.' },
    ]);
});
