import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';

import {
    MESSAGE_ARGUMENTS,
    MESSAGE_LAYOUTS,
    TRANSLATION_CASES,
    TRANSLATION_FINDINGS,
    TRANSLATION_SANDBOX,
    TRANSLATION_TABLES,
} from '#tests/config/configurations/library.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { assertCheckSample } from '#tests/setup/cli/samples.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createSandbox } from '#tests/setup/sandboxes/create.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('a missing base locale is reported and restoring it enables key comparisons', async () => {
    await using sandbox = await createGitSandbox({
        'messages/de.json': '{}',
        'package.json': JSON.stringify({ dependencies: TRANSLATION_SANDBOX.dependencies }),
        'gspot.toml': buildSandboxSettings(['translations'], { level: 'all', tables: TRANSLATION_TABLES }),
    });

    const missing = await runSandboxCheck(sandbox.path, 'translations/messages', { paths: ['messages/de.json'] });
    expect(missing).toMatchObject([{ file: 'messages/en.json', rule: 'base-locale' }]);
    await writeFile(join(sandbox.path, 'messages/en.json'), '{"heading":"Welcome"}');
    const compared = await runSandboxCheck(sandbox.path, 'translations/messages', {
        paths: ['messages/de.json', 'messages/en.json'],
    });
    expect(compared).toMatchObject([{ file: 'messages/de.json', rule: 'missing-key' }]);
});

test.each([...TRANSLATION_CASES])(
    '$check reports $expected.rule in $expected.file and passes after the fix',
    async (sample) => {
        await using repository = await createSandbox(TRANSLATION_SANDBOX);
        await assertCheckSample(repository, sample);
    },
);

test.each([...MESSAGE_LAYOUTS])(
    'each message file compares with its own base locale file: $layout',
    async ({ files, expected }) => {
        await using sandbox = await createGitSandbox({
            ...files,
            'package.json': JSON.stringify({ dependencies: TRANSLATION_SANDBOX.dependencies }),
            'gspot.toml': buildSandboxSettings(['translations'], { level: 'all', tables: TRANSLATION_TABLES }),
        });
        const findings = await runSandboxCheck(sandbox.path, 'translations/messages');
        expect(findings.map(({ file, message }) => ({ file, message }))).toStrictEqual(expected);
    },
);

test('a translation keeps the arguments, tags, and select keys of its base message, and its own plural categories', async () => {
    await using sandbox = await createGitSandbox({
        'messages/en.json': JSON.stringify(MESSAGE_ARGUMENTS.base),
        'messages/fr.json': JSON.stringify(MESSAGE_ARGUMENTS.translated),
        'package.json': JSON.stringify({ dependencies: TRANSLATION_SANDBOX.dependencies }),
        'gspot.toml': buildSandboxSettings(['translations'], { level: 'all', tables: TRANSLATION_TABLES }),
    });
    const findings = await runSandboxCheck(sandbox.path, 'translations/messages');
    expect(findings.map(({ file, rule, message }) => ({ file, rule, message }))).toStrictEqual([
        ...TRANSLATION_FINDINGS,
    ]);
});

test('translations/messages reports an empty message', async () => {
    const files = { 'messages/en.json': '{"greeting":"Hello","farewell":"Bye"}' };
    await using changedSandbox = await createGitSandbox({
        ...files,
        'messages/fr.json': '{"greeting":"Bonjour","farewell":""}',
        'package.json': JSON.stringify({ dependencies: TRANSLATION_SANDBOX.dependencies }),
        'gspot.toml': buildSandboxSettings(['translations'], { level: 'all', tables: TRANSLATION_TABLES }),
    });
    const empty = await runSandboxCheck(changedSandbox.path, 'translations/messages');
    expect(empty.map(({ file, line, rule, message }) => ({ file, line, rule, message }))).toStrictEqual([
        { file: 'messages/fr.json', line: 1, rule: 'message', message: expect.stringContaining('farewell') as string },
    ]);
});

test('a malformed locale does not hide missing or extra keys in another locale', async () => {
    await using sandbox = await createGitSandbox({
        'messages/en.json': '{"heading":"Welcome"}',
        'messages/de.json': '{',
        'messages/fr.json': '{\n  "extra": "Bonjour"\n}',
        'package.json': JSON.stringify({ dependencies: TRANSLATION_SANDBOX.dependencies }),
        'gspot.toml': buildSandboxSettings(['translations'], { level: 'all', tables: TRANSLATION_TABLES }),
    });
    const findings = await runSandboxCheck(sandbox.path, 'translations/messages');
    expect(findings.map(({ file, line, rule }) => ({ file, line, rule }))).toStrictEqual([
        { file: 'messages/de.json', line: 1, rule: 'syntax' },
        { file: 'messages/fr.json', line: 1, rule: 'missing-key' },
        { file: 'messages/fr.json', line: 2, rule: 'extra-key' },
    ]);
});

test('a plural branch can print its enclosing count as an argument or a pound sign', async () => {
    await using sandbox = await createGitSandbox({
        'messages/en.json': '{"items":"{count, plural, one {# item} other {# items}}"}',
        'messages/fr.json': '{"items":"{count, plural, one {{count} item} other {{count} items}}"}',
        'package.json': JSON.stringify({ dependencies: TRANSLATION_SANDBOX.dependencies }),
        'gspot.toml': buildSandboxSettings(['translations'], { level: 'all', tables: TRANSLATION_TABLES }),
    });
    const findings = await runSandboxCheck(sandbox.path, 'translations/messages');
    expect(findings).toStrictEqual([]);
});
