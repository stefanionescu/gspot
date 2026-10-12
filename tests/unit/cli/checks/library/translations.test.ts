import { join } from 'node:path';
import { stringify } from 'smol-toml';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { containing } from '#tests/setup/matchers.ts';
import { runCheckSample } from '#tests/setup/fixes.ts';
import { createSandbox } from '#tests/setup/sandbox.ts';
import { checkFindings } from '#tests/setup/check-input.ts';
import { TRANSLATION_CASES, TRANSLATION_REPOSITORY } from '#tests/config/translations.ts';

test('a missing base locale is reported and restoring it enables key comparisons', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'messages/de.json': '{}',
        'package.json': JSON.stringify({ dependencies: TRANSLATION_REPOSITORY.dependencies }),
    });
    const settings = { configurations: ['translations'], translations: { messages_folder: 'messages' } };
    await Bun.write(join(sandbox.path, 'gspot.toml'), stringify({ level: 'all', ...settings }));
    const missing = await checkFindings(sandbox.path, 'translations/messages', { paths: ['messages/de.json'] });
    expect(missing).toMatchObject([{ file: 'messages/en.json', rule: 'base-locale' }]);
    await Bun.write(join(sandbox.path, 'messages/en.json'), '{"heading":"Welcome"}');
    const compared = await checkFindings(sandbox.path, 'translations/messages', {
        paths: ['messages/de.json', 'messages/en.json'],
    });
    expect(compared).toMatchObject([{ file: 'messages/de.json', rule: 'missing-key' }]);
});

test.each([...TRANSLATION_CASES])('$check reports $expected.rule and passes after the fix', async (entry) => {
    await using repository = await createSandbox(TRANSLATION_REPOSITORY);
    const { failed, passed } = await runCheckSample(repository, entry, TRANSLATION_REPOSITORY);
    expect(failed.code, `${entry.check}: ${failed.stdout}${failed.stderr}`).toBe(1);
    expect(failed.report.checks).toMatchObject([{ check: entry.check, status: 'failed' }]);
    expect(failed.report.checks[0]?.findings).toContainEqual(containing({ check: entry.check, ...entry.expected }));
    expect(passed.code, `${entry.check} corrected: ${passed.stdout}${passed.stderr}`).toBe(0);
    expect(passed.report.checks).toMatchObject([{ check: entry.check, status: 'passed', findings: [] }]);
});
