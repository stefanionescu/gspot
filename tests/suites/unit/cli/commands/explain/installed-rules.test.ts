import { tmpdir, devNull } from 'node:os';
import { join, dirname } from 'node:path';
import { createFileTree } from 'testdirs';
import { readFile } from 'node:fs/promises';
import { test, spyOn, expect } from 'bun:test';
import { openSession } from '#cli/engine/session.ts';
import * as processes from '#cli/system/processes.ts';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { createRunResources } from '#tests/setup/cli/run.ts';
import { buildMiseInstall } from '#cli/tools/installers/mise.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { fakeCommands, fakeExecutableLookup } from '#tests/setup/system/fakes.ts';

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
    const missing = await runGspot(sandbox.path, ['explain', 'markdown/markdownlint', 'MD999']);
    expect(missing.code).toBe(2);
    expect(missing.stderr).toContain('does not know rule MD999');
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
    const blocking = processes.spawnProcessBlocking;
    using _bins = spyOn(processes, 'spawnProcessBlocking').mockImplementation((command, options) =>
        command[1] === 'bin-paths' ? buildProcessResult({ stdout: dirname(executable) }) : blocking(command, options),
    );
    using commands = fakeCommands(executable).mockImplementation((command) =>
        Promise.resolve(
            command.at(-1) === 'force_cast'
                ? buildProcessResult({ stdout: 'Force Cast (force_cast): Force casts should be avoided\n' })
                : buildProcessResult({ code: 1, stderr: 'Error: No rule with identifier: force_castt' }),
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
    const unknown = await runGspot(sandbox.path, ['explain', 'swift/swiftlint', 'force_castt']);
    expect(unknown.code).toBe(2);
    expect(unknown.stderr).toContain('does not know rule force_castt');
});

test('declarative Biome rule selection and ShellCheck identifiers refuse misspelled rule names', async () => {
    await using sandbox = await createGitSandbox({});
    for (const [check, rule] of [
        ['javascript/biome', 'lint/complexity/notARule'],
        ['bash/shellcheck', 'SC20X6'],
    ]) {
        const unknown = await runGspot(sandbox.path, ['explain', check!, rule!]);
        expect(unknown.code).toBe(2);
        expect(unknown.stderr).toContain('does not know rule');
    }
    const described = await runGspot(sandbox.path, [
        'explain',
        'javascript/biome',
        'lint/complexity/noExcessiveCognitiveComplexity',
    ]);
    expect(described.code, described.stdout + described.stderr).toBe(0);
});
