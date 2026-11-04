import { test, expect } from 'bun:test';
import { tmpdir, devNull } from 'node:os';
import { join, dirname } from 'node:path';
import { createFileTree } from 'testdirs';
import { readFile } from 'node:fs/promises';
import { parse } from '@decimalturn/toml-patch';
import { openSession } from '#cli/engine/session.ts';
import { buildMiseInstall } from '#cli/tools/pins.ts';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import type { TomlTable } from '#cli/types/settings.ts';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { VALE_STYLES_PATH } from '#cli/config/tools/vale.ts';
import { createRunResources } from '#tests/setup/cli/run.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { fakeCommands, fakeExecutableLookup } from '#tests/setup/system/fakes.ts';
import { EMPTY_VALE_INI, VALE_INSTALLED_FILES } from '#tests/config/configurations/general.ts';

test('Markdownlint validates a rule against its installed catalog without evaluating package code', async () => {
    const settings = buildSandboxSettings(['markdown']);
    await using sandbox = await createGitSandbox({ 'gspot.toml': settings, 'guide.md': '# Guide\n' });
    await createFileTree(sandbox.path, {
        '.gspot/node_modules/markdownlint/package.json': '{"exports":"./lib/exports.mjs"}',
        '.gspot/node_modules/markdownlint/lib/exports.mjs': 'throw new Error("Package code must not run");',
        '.gspot/node_modules/markdownlint/schema/markdownlint-config-schema.json': JSON.stringify({
            properties: {
                MD001: {
                    description:
                        'MD001/heading-increment : Heading levels should only increment by one level at a time : https://github.com/DavidAnson/markdownlint/blob/v0.41.1/doc/md001.md',
                },
            },
        }),
    });
    const described = await runGspot(sandbox.path, ['explain', 'markdown/markdownlint', 'MD001', '--json']);
    expect(described.code, described.stdout + described.stderr).toBe(0);
    expect(JSON.parse(described.stdout)).toMatchObject({
        rule: 'MD001',
        description: 'Heading levels should only increment by one level at a time',
    });
    const missing = await runGspot(sandbox.path, ['explain', 'markdown/markdownlint', 'MD999', '--json']);
    expect(missing.code).toBe(2);
    expect(JSON.parse(missing.stdout)).toMatchObject({
        error: 'arguments',
        message: expect.stringContaining('MD999') as string,
    });
    const ignored = await runGspot(sandbox.path, [
        'ignore',
        'markdown/markdownlint',
        '--rule',
        'MD999',
        '--reason',
        'Generated text keeps a different layout.',
    ]);
    expect(ignored.code).toBe(2);
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(settings);
});

test('SwiftLint validates rules with installed metadata and an empty explicit configuration', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings(['swift']) });
    const executable = join(sandbox.path, 'tools/swiftlint');
    using resources = createRunResources();
    const session = await openSession(sandbox.path, { resources });
    await createFileTree(sandbox.path, {
        '.gspot/mise.toml': buildMiseInstall(session.toolConfigurations).content,
        'tools/swiftlint': '',
    });
    using _lookup = fakeExecutableLookup((name) => {
        if (name === 'swiftlint') return null;
        return name === 'mise' ? join(tmpdir(), 'mise') : undefined;
    });
    using _bins = fakeCommands('mise', () => Promise.resolve(buildProcessResult({ stdout: dirname(executable) })));
    using commands = fakeCommands(executable).mockImplementation((command) =>
        Promise.resolve(
            buildProcessResult(
                command.at(-1) === 'force_cast'
                    ? { stdout: 'Force Cast (force_cast): Force casts should be avoided\n' }
                    : { code: 1, stderr: 'Error: No rule with identifier: force_castt' },
            ),
        ),
    );
    const described = await runGspot(sandbox.path, ['explain', 'swift/swiftlint', 'force_cast', '--json']);
    expect(described.code, described.stdout + described.stderr).toBe(0);
    expect(JSON.parse(described.stdout)).toMatchObject({
        description: 'Force Cast (force_cast): Force casts should be avoided',
    });
    expect(commands.mock.calls[0]?.[0]).toStrictEqual([
        executable,
        'rules',
        '--default-config',
        '--config',
        devNull,
        'force_cast',
    ]);
    const unknown = await runGspot(sandbox.path, ['explain', 'swift/swiftlint', 'force_castt', '--json']);
    expect(unknown.code).toBe(2);
    expect(JSON.parse(unknown.stdout)).toMatchObject({
        error: 'arguments',
        message: expect.stringContaining('force_castt') as string,
    });
});

test('declarative Biome rule selection and ShellCheck identifiers refuse misspelled rule names', async () => {
    await using sandbox = await createGitSandbox({});
    for (const [check, rule] of [
        ['javascript/biome', 'lint/complexity/notARule'],
        ['bash/shellcheck', 'SC20X6'],
    ]) {
        const unknown = await runGspot(sandbox.path, ['explain', check!, rule!, '--json']);
        expect(unknown.code).toBe(2);
        expect(JSON.parse(unknown.stdout)).toMatchObject({
            error: 'arguments',
            message: expect.stringContaining(rule!) as string,
        });
    }
    const described = await runGspot(sandbox.path, [
        'explain',
        'javascript/biome',
        'lint/complexity/noExcessiveCognitiveComplexity',
    ]);
    expect(described.code, described.stdout + described.stderr).toBe(0);
});

test('Vale reads a rule from the style files that Vale loads, and gspot ignore takes it', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['prose', 'markdown']),
        'guide.md': '# Guide\n',
    });
    const uninstalled = await runGspot(sandbox.path, ['explain', 'prose/vale', 'gspot.home-paths', '--json']);
    expect(uninstalled.code).toBe(2);
    expect(JSON.parse(uninstalled.stdout)).toMatchObject({ error: 'tool' });
    await createFileTree(sandbox.path, {
        ...VALE_INSTALLED_FILES,
        [GSPOT_PATHS.valeConfig]: EMPTY_VALE_INI,
        [`${VALE_STYLES_PATH}/gspot/home-paths.yml`]: 'message: "Write a path that every reader has."\n',
        [`${GSPOT_PATHS.valePackages}/Google/Passive.yml`]:
            'message: "Use active voice."\nlink: https://example.com/voice\n',
    });
    for (const [rule, docs] of [
        ['gspot.home-paths', { description: 'Write a path that every reader has.', page: null }],
        ['Google.Passive', { description: 'Use active voice.', page: 'https://example.com/voice' }],
    ] as const) {
        const described = await runGspot(sandbox.path, ['explain', 'prose/vale', rule, '--json']);
        expect(described.code, described.stdout + described.stderr).toBe(0);
        expect(JSON.parse(described.stdout)).toMatchObject({ tool: 'vale', rule, ...docs });
    }
    const unknown = await runGspot(sandbox.path, ['explain', 'prose/vale', 'gspot.home-path', '--json']);
    expect(unknown.code).toBe(2);
    expect(JSON.parse(unknown.stdout)).toMatchObject({
        error: 'arguments',
        message: expect.stringMatching(/\bgspot\.home-path\b/u) as string,
    });
    const reason = 'The guide shows a home folder on purpose.';
    const ignored = await runGspot(sandbox.path, [
        'ignore',
        'prose/vale',
        '--rule',
        'gspot.home-paths',
        '--paths',
        'guide.md',
        '--reason',
        reason,
    ]);
    expect(ignored.code, ignored.stdout + ignored.stderr).toBe(0);
    const written = parse(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')) as TomlTable;
    expect(written['ignore']).toStrictEqual([
        { check: 'prose/vale', rule: 'gspot.home-paths', paths: ['guide.md'], reason },
    ]);
});
