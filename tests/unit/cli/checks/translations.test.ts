import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { matchFields } from '#tests/setup/matchers.ts';
import { createSandbox } from '#tests/setup/sandbox.ts';
import { checkFindings } from '#tests/setup/check-input.ts';
import { runCheckSample } from '#tests/setup/sample-checks.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';

import {
    MESSAGE_LAYOUTS,
    NEXT_TRANSLATIONS,
    MESSAGE_ARGUMENTS,
    TRANSLATION_CASES,
    TRANSLATION_SANDBOX,
} from '#tests/data/checks/translations.ts';

test('a missing base locale is reported and restoring it enables key comparisons', async () => {
    await using sandbox = await testdir({
        'messages/de.json': '{}',
        'package.json': JSON.stringify({ dependencies: TRANSLATION_SANDBOX.dependencies }),
    });

    await writeFile(
        join(sandbox.path, 'gspot.toml'),
        buildSandboxSettings(['translations'], { level: 'all', tables: NEXT_TRANSLATIONS }),
    );
    const missing = await checkFindings(sandbox.path, 'translations/messages', { paths: ['messages/de.json'] });
    expect(missing).toMatchObject([{ file: 'messages/en.json', rule: 'base-locale' }]);
    await writeFile(join(sandbox.path, 'messages/en.json'), '{"heading":"Welcome"}');
    const compared = await checkFindings(sandbox.path, 'translations/messages', {
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
        const findings = await checkMessageFiles(files);
        expect(findings.map(({ file, message }) => ({ file, message }))).toStrictEqual(expected);
    },
);

test('a translation keeps the arguments, tags, and select keys of its base message, and its own plural categories', async () => {
    const findings = await checkMessageFiles({
        'messages/en.json': JSON.stringify(MESSAGE_ARGUMENTS.base),
        'messages/fr.json': JSON.stringify(MESSAGE_ARGUMENTS.translated),
    });
    expect(findings.map(({ file, rule, message }) => ({ file, rule, message }))).toStrictEqual([
        {
            file: 'messages/fr.json',
            rule: 'message-arguments',
            message:
                'greet: en has {name}, which this message leaves out. This message has {nom}, which en does not have.',
        },
        {
            file: 'messages/fr.json',
            rule: 'message-arguments',
            message:
                'pick: en has {gender, select, female male other}, which this message leaves out. This message has {gender, select, male other}, which en does not have.',
        },
    ]);
});

async function checkMessageFiles(files: Record<string, string>) {
    await using sandbox = await testdir({
        ...files,
        'package.json': JSON.stringify({ dependencies: TRANSLATION_SANDBOX.dependencies }),
        'gspot.toml': buildSandboxSettings(['translations'], { level: 'all', tables: NEXT_TRANSLATIONS }),
    });

    return await checkFindings(sandbox.path, 'translations/messages');
}
