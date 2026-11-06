import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { parse } from '@decimalturn/toml-patch';
import { expect, test } from 'bun:test';
import { createFileTree } from 'testdirs';

import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { VALE_STYLES_PATH } from '#cli/config/tools/vale.ts';
import { openSession } from '#cli/engine/session.ts';
import { buildMiseInstall } from '#cli/tools/pins.ts';
import type { TomlTable } from '#cli/types/settings.ts';
import type { SpawnResult } from '#cli/types/system.ts';
import { EMPTY_VALE_INI, VALE_INSTALLED_FILES } from '#tests/config/configurations/general.ts';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { getShippedCheck } from '#tests/setup/cli/manifests.ts';
import { createRunResources } from '#tests/setup/cli/run.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { fakeCommands, fakeExecutableLookup } from '#tests/setup/system/fakes.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';

async function fakeSwiftlint(
    root: string,
    answer: (command: readonly string[]) => Partial<SpawnResult>,
): Promise<DisposableStack> {
    const executable = join(root, 'tools/swiftlint');
    using resources = createRunResources();
    const session = await openSession(root, { resources });
    await createFileTree(root, {
        '.gspot/mise.toml': buildMiseInstall(session.toolConfigurations).content,
        'tools/swiftlint': '',
    });
    const fakes = new DisposableStack();
    fakes.use(
        fakeExecutableLookup((name) => {
            if (name === 'swiftlint') return null;
            return name === 'mise' ? join(tmpdir(), 'mise') : undefined;
        }),
    );
    fakes.use(fakeCommands('mise', () => Promise.resolve(buildProcessResult({ stdout: dirname(executable) }))));
    fakes.use(
        fakeCommands(executable).mockImplementation((command) => Promise.resolve(buildProcessResult(answer(command)))),
    );
    return fakes;
}

test('set refuses a rule that the installed catalog does not hold, and takes one that it holds', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['markdown']),
        'guide.md': '# Guide\n',
    });
    await createFileTree(sandbox.path, {
        '.gspot/node_modules/markdownlint/package.json': '{"exports":"./lib/exports.mjs"}',
        '.gspot/node_modules/markdownlint/lib/exports.mjs': 'throw new Error("Package code must not run");',
        '.gspot/node_modules/markdownlint/schema/markdownlint-config-schema.json': JSON.stringify({
            properties: { MD026: { description: 'MD026/no-trailing-punctuation : Punctuation : https://example.com' } },
        }),
    });
    const refused = await runGspot(sandbox.path, [
        'set',
        'tools.markdownlint.rules',
        '{ MD999 = { punctuation = "." } }',
    ]);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(refused.stderr).toContain('gspot does not know rule MD999 of markdown/markdownlint.');
    const taken = await runGspot(sandbox.path, [
        'set',
        'tools.markdownlint.rules',
        '{ MD026 = { punctuation = "." } }',
    ]);
    expect(taken.code, taken.stdout + taken.stderr).toBe(0);
});

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

test('a SwiftLint rule explains from the installed tool, and a name it does not know is refused', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings(['swift']) });
    using _fakes = await fakeSwiftlint(sandbox.path, (command) =>
        command.at(-1) === 'force_cast'
            ? { stdout: 'Force Cast (force_cast): Force casts should be avoided\n' }
            : { code: 1, stderr: 'Error: No rule with identifier: force_castt' },
    );
    const described = await runGspot(sandbox.path, ['explain', 'swift/swiftlint', 'force_cast', '--json']);
    expect(described.code, described.stdout + described.stderr).toBe(0);
    expect(JSON.parse(described.stdout)).toMatchObject({
        description: 'Force Cast (force_cast): Force casts should be avoided',
    });
    const unknown = await runGspot(sandbox.path, ['explain', 'swift/swiftlint', 'force_castt', '--json']);
    expect(unknown.code).toBe(2);
    expect(JSON.parse(unknown.stdout)).toMatchObject({
        error: 'arguments',
        message: expect.stringContaining('force_castt') as string,
    });
});

test.each([
    { failure: 'a signal', result: { end: 'failed', signal: 'SIGABRT', stderr: 'Could not read configuration' } },
    { failure: 'exit code 127', result: { code: 127, stderr: 'error while loading shared libraries' } },
] as const)('after $failure from SwiftLint, explain prints the check help and ignore goes on', async ({ result }) => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings(['swift']) });
    using _fakes = await fakeSwiftlint(sandbox.path, () => result);
    const explained = await runGspot(sandbox.path, ['explain', 'swift/swiftlint', 'force_cast', '--json']);
    expect(explained.code, explained.stdout + explained.stderr).toBe(0);
    expect(JSON.parse(explained.stdout)).toMatchObject({
        rule: 'force_cast',
        description: null,
        fix: getShippedCheck('swift/swiftlint').help,
    });
    const reason = 'The parser keeps this cast on purpose.';
    const ignored = await runGspot(sandbox.path, [
        'ignore',
        'swift/swiftlint',
        '--rule',
        'force_cast',
        '--reason',
        reason,
    ]);
    expect(ignored.code, ignored.stdout + ignored.stderr).toBe(0);
    const written = parse(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')) as TomlTable;
    expect(written['ignore']).toStrictEqual([{ check: 'swift/swiftlint', rule: 'force_cast', reason }]);
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
        [`${VALE_STYLES_PATH}/gspot/home-paths.yml`]: 'message: "Write a path that every reader has, not \'%s\'."\n',
        [`${GSPOT_PATHS.valePackages}/Google/Passive.yml`]:
            'message: "Use active voice."\nlink: https://example.com/voice\n',
    });
    for (const [rule, docs] of [
        ['gspot.home-paths', { description: "Write a path that every reader has, not '<text>'.", page: null }],
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
