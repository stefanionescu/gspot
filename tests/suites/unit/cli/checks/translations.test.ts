import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { matchFields } from '#tests/setup/matchers.ts';
import { type Finding } from '#cli/types/runs/check.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { runCheckSample } from '#tests/setup/cli/samples.ts';
import { createSandbox } from '#tests/setup/sandboxes/create.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';

import {
    MESSAGE_LAYOUTS,
    MESSAGE_ARGUMENTS,
    TRANSLATION_CASES,
    TRANSLATION_TABLES,
    TRANSLATION_SANDBOX,
    TRANSLATION_FINDINGS,
} from '#tests/config/checks/translations.ts';

async function runMessagesCheck(files: Record<string, string>): Promise<readonly Finding[]> {
    await using sandbox = await testdir({
        ...files,
        'package.json': JSON.stringify({ dependencies: TRANSLATION_SANDBOX.dependencies }),
        'gspot.toml': buildSandboxSettings(['translations'], { level: 'all', tables: TRANSLATION_TABLES }),
    });

    return await runSandboxCheck(sandbox.path, 'translations/messages');
}

test('a missing base locale is reported and restoring it enables key comparisons', async () => {
    await using sandbox = await testdir({
        'messages/de.json': '{}',
        'package.json': JSON.stringify({ dependencies: TRANSLATION_SANDBOX.dependencies }),
    });

    await writeFile(
        join(sandbox.path, 'gspot.toml'),
        buildSandboxSettings(['translations'], { level: 'all', tables: TRANSLATION_TABLES }),
    );
    const missing = await runSandboxCheck(sandbox.path, 'translations/messages', { paths: ['messages/de.json'] });
    expect(missing).toMatchObject([{ file: 'messages/en.json', rule: 'base-locale' }]);
    await writeFile(join(sandbox.path, 'messages/en.json'), '{"heading":"Welcome"}');
    const compared = await runSandboxCheck(sandbox.path, 'translations/messages', {
        paths: ['messages/de.json', 'messages/en.json'],
    });
    expect(compared).toMatchObject([{ file: 'messages/de.json', rule: 'missing-key' }]);
});

test.each([...TRANSLATION_CASES])('$check reports $expected.rule and passes after the fix', async (entry) => {
    await using repository = await createSandbox(TRANSLATION_SANDBOX);
    const { failed, passed } = await runCheckSample(repository, entry, TRANSLATION_SANDBOX);

    expect(failed.report.checks).toMatchObject([{ check: entry.check, status: 'failed' }]);
    expect(failed.report.checks[0]?.findings).toContainEqual(matchFields({ check: entry.check, ...entry.expected }));

    expect(passed.report.checks).toMatchObject([{ check: entry.check, status: 'passed', findings: [] }]);
});

test.each([...MESSAGE_LAYOUTS])(
    'each message file compares with its own base locale file: $layout',
    async ({ files, expected }) => {
        const findings = await runMessagesCheck(files);
        expect(findings.map(({ file, message }) => ({ file, message }))).toStrictEqual(expected);
    },
);

test('a translation keeps the arguments, tags, and select keys of its base message, and its own plural categories', async () => {
    const findings = await runMessagesCheck({
        'messages/en.json': JSON.stringify(MESSAGE_ARGUMENTS.base),
        'messages/fr.json': JSON.stringify(MESSAGE_ARGUMENTS.translated),
    });
    expect(findings.map(({ file, rule, message }) => ({ file, rule, message }))).toStrictEqual([
        ...TRANSLATION_FINDINGS,
    ]);
});

test('translations/messages reports a message file that is not JSON as syntax and an empty message as message', async () => {
    const files = { 'messages/en.json': '{"greeting":"Hello","farewell":"Bye"}', 'messages/fr.json': '{ broken' };
    const broken = await runMessagesCheck(files);
    expect(broken.map(({ file, line, rule, message }) => ({ file, line, rule, message }))).toStrictEqual([
        {
            file: 'messages/fr.json',
            line: 1,
            rule: 'syntax',
            message: 'messages/fr.json is not valid JSON: Invalid JSON at offset 2: InvalidSymbol. Fix the file.',
        },
    ]);
    const empty = await runMessagesCheck({ ...files, 'messages/fr.json': '{"greeting":"Bonjour","farewell":""}' });
    expect(empty.map(({ file, line, rule, message }) => ({ file, line, rule, message }))).toStrictEqual([
        { file: 'messages/fr.json', line: 1, rule: 'message', message: 'farewell: The message is empty.' },
    ]);
});
