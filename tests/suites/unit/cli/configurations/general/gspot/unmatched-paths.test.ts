import { test, expect } from 'bun:test';
import { stringify } from '@decimalturn/toml-patch';
import { commitAll } from '#tests/setup/system/git.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { TERMS_SOURCE } from '#tests/config/setup/languages.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { UNMATCHED_PATH_CASES } from '#tests/config/configurations/general.ts';

test.each([...UNMATCHED_PATH_CASES])(
    'gspot/unmatched-paths reports each setting path without a tracked match: $name',
    async ({ files, settings, unmatched }) => {
        const { configurations, ...tables } = settings;
        await using sandbox = await createGitSandbox({
            ...files,
            'gspot.toml': buildSandboxSettings(configurations, {
                level: 'all',
                rules: true,
                tables: stringify(tables),
            }),
        });
        commitAll(sandbox.path);
        const findings = await runSandboxCheck(sandbox.path, 'gspot/unmatched-paths');
        expect(findings.map((finding) => finding.message)).toStrictEqual(
            unmatched.map(([selector, where]) => expect.stringContaining(`${selector} under ${where} `) as string),
        );
        expect(findings).toMatchObject(
            unmatched.map(() => ({ check: 'gspot/unmatched-paths', file: 'gspot.toml', rule: 'unmatched-path' })),
        );
    },
);

test('an unmatched ignore path with an unescaped route group gets help to escape its brackets', async () => {
    const ignores = ['app/(missing)/**', 'gone/**']
        .map((path) => `[[ignore]]\ncheck = "structure/lone-files"\npaths = ["${path}"]\nreason = "A route group."\n`)
        .join('');
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['typescript'], { tables: ignores }),
        'app/(legal)/terms/page.tsx': TERMS_SOURCE,
    });
    commitAll(sandbox.path);
    const unmatched = await runSandboxCheck(sandbox.path, 'gspot/unmatched-paths');
    const [bracketed, unbracketed] = unmatched.map(({ message }) => message);
    expect(unmatched).toHaveLength(2);
    expect(bracketed).toStartWith(unbracketed!.replace('gone/**', 'app/(missing)/**'));
    expect(bracketed!.length).toBeGreaterThan(unbracketed!.length);
});

test('an unmatched ignore points at its written record', async () => {
    const text = buildSandboxSettings([], {
        tables: '\n[[ignore]]\npaths = ["missing/**"]\nreason = "This sample names an absent folder."\n',
    });
    await using sandbox = await createGitSandbox({ 'gspot.toml': text });
    commitAll(sandbox.path);
    const findings = await runSandboxCheck(sandbox.path, 'gspot/unmatched-paths');
    expect(findings).toMatchObject([{ file: 'gspot.toml', line: text.split('\n').indexOf('[[ignore]]') + 1 }]);
});

test('a scope pattern that starts at the repository root names its scope-relative form, and a typo does not', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], {
            scopes: [{ path: 'api', configurations: ['javascript'] }],
            tables: '[scope.javascript]\nentry_files = ["api/functions/*/index.js", "api/absent/*.js"]\n',
        }),
        'api/functions/send/index.js': 'export const ready = true;\n',
    });
    commitAll(sandbox.path);
    const findings = await runSandboxCheck(sandbox.path, 'gspot/unmatched-paths');
    expect(findings.map(({ message }) => message)).toStrictEqual([
        'api/api/functions/*/index.js under scope.0.javascript.entry_files matches no tracked file or folder. A path in a [[scope]] table is relative to that scope, so write "functions/*/index.js".',
        'api/api/absent/*.js under scope.0.javascript.entry_files matches no tracked file or folder.',
    ]);
});

test('a negated path that names an existing file is matched', async () => {
    const paths = ['src/**', '!src/kept.txt', '!gone/**'];
    const tables = stringify({ format: { override: [{ paths, quotes: 'single' }] } });
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['format'], { level: 'all', tables }),
        'src/kept.txt': 'kept\n',
    });
    commitAll(sandbox.path);
    const findings = await runSandboxCheck(sandbox.path, 'gspot/unmatched-paths');
    expect(findings.map(({ rule, message }) => ({ rule, message }))).toStrictEqual([
        { rule: 'unmatched-path', message: expect.stringContaining('!gone/**') as string },
    ]);
});
