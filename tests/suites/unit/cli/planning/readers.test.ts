import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { openSession } from '#cli/planning/session.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { listSettingReaders } from '#cli/planning/readers.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { GENERATOR_LIMITS, BUILT_IN_LIMIT_CASES } from '#tests/config/planning/readers.ts';

test('limit readers belong to the requested language', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript', 'python', 'swift'], { level: 'all' }),
    });
    const session = await openSession(sandbox.path);
    expect(listSettingReaders(session.settings, session.scopes[0]!, 'limits.python.file_lines')).toStrictEqual([
        { check: 'structure/long-files', enabled: true },
    ]);
    expect(listSettingReaders(session.settings, session.scopes[0]!, 'limits.swift.file_lines')).toStrictEqual([
        { check: 'swift/swiftlint', enabled: true },
    ]);
});

test('limit readers report their enabled state and exact level note', async () => {
    await using sandbox = await testdir({ 'gspot.toml': buildSandboxSettings(['python'], { level: 'basic' }) });
    const session = await openSession(sandbox.path);
    expect(listSettingReaders(session.settings, session.scopes[0]!, 'limits.python.function_lines')).toStrictEqual([
        { check: 'python/function-size', enabled: false, note: 'off at level basic' },
    ]);
    expect(
        listSettingReaders({ ...session.settings, level: 'all' }, session.scopes[0]!, 'limits.python.function_lines'),
    ).toStrictEqual([{ check: 'python/function-size', enabled: true }]);
});

test.each(
    GENERATOR_LIMITS.flatMap(({ check, file, languages, limits }) =>
        languages.flatMap((language) => limits.map((limit) => ({ check, file, language, limit }))),
    ),
)(
    '$check writes the configured $limit limit of $language into its generated file',
    async ({ check, file, language, limit }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings([language], {
                level: 'all',
                tables: `[structure]\nreexports = { value = "index-only", reason = "The index export limit needs an enabled index module." }\n[limits.${language}]\n${limit} = ${limit === 'trivial_function_statements' ? '1001' : '{ value = 1001, reason = "The generated limit must retain this distinctive value." }'}\n`,
            }),
        });
        const session = await openSession(sandbox.path);
        const generated = buildGeneratedFiles(session).files.find(({ path }) => path.endsWith(file));
        expect(generated, `${check} generates ${file}`).toBeDefined();
        expect(generated!.content).toMatch(/\b1001\b/u);
    },
);

test.each([...BUILT_IN_LIMIT_CASES])('$check reads the $limit limit of $language', async (sample) => {
    const configuration = sample.language === 'sql' ? 'postgres' : sample.language;
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings([configuration], {
            level: 'all',
            tables: `[limits.${sample.language}]\n${sample.limit} = 3\n`,
        }),
        [sample.file]: sample.source,
    });
    const findings = await runSandboxCheck(sandbox.path, sample.check);
    expect(findings.map(({ file, rule }) => ({ file, rule }))).toContainEqual({ file: sample.file, rule: sample.rule });
    await writeFile(
        join(sandbox.path, 'gspot.toml'),
        buildSandboxSettings([configuration], {
            level: 'all',
            tables: `[limits.${sample.language}]\n${sample.limit} = ${sample.limit === 'trivial_function_statements' ? '2' : '{ value = 1001, reason = "The sample falls below this configured threshold." }'}\n`,
        }),
    );
    expect(await runSandboxCheck(sandbox.path, sample.check)).toStrictEqual([]);
});

test('shared-prefixes reads its configured sibling limit', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript'], {
            level: 'all',
            tables: '[limits]\nshared_prefix_files = { value = 3, reason = "Three related files form the configured group." }\n',
        }),
        'order-first.js': 'export const first = 1;\n',
        'order-second.js': 'export const second = 2;\n',
        'order-third.js': 'export const third = 3;\n',
    });
    expect(await runSandboxCheck(sandbox.path, 'structure/shared-prefixes')).toHaveLength(1);
    await writeFile(
        join(sandbox.path, 'gspot.toml'),
        buildSandboxSettings(['javascript'], {
            level: 'all',
            tables: '[limits]\nshared_prefix_files = { value = 5, reason = "Five related files form the configured group." }\n',
        }),
    );
    expect(await runSandboxCheck(sandbox.path, 'structure/shared-prefixes')).toStrictEqual([]);
});
