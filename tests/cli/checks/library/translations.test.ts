import { join } from 'node:path';
import { stringify } from 'smol-toml';
import { test, expect } from 'bun:test';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/public.ts';
import { buildCheckInput } from '#tests/harness/input.ts';
import { containing } from '#tests/harness/expectations.ts';
import { BUILT_IN_CALCULATIONS } from '#cli/checks/public.ts';
import { runFindingCase } from '#tests/harness/check-case.ts';
import { CASES, REPOSITORY } from '#tests/config/cli/checks/library/translations.ts';
import { createTestRepository, prepareCliRepository } from '#tests/harness/repository.ts';

test('a missing base locale is reported and restoring it enables key comparisons', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'messages/de.json': '{}' });
    const policy = { configurations: ['translations'], translations: { messages_folder: 'messages' } };
    await Bun.write(join(sandbox.path, 'gspot.toml'), stringify({ level: 'all', ...policy }));
    const missing = BUILT_IN_CALCULATIONS['translations/locales'](
        buildCheckInput(await openSession(sandbox.path), 'translations/locales', { paths: ['messages/de.json'] }),
    );
    expect(missing).toMatchObject([{ file: 'messages/en.json', rule: 'base-locale' }]);
    await Bun.write(join(sandbox.path, 'messages/en.json'), '{"heading":"Welcome"}');
    const compared = BUILT_IN_CALCULATIONS['translations/locales'](
        buildCheckInput(await openSession(sandbox.path), 'translations/locales', {
            paths: ['messages/de.json', 'messages/en.json'],
        }),
    );
    expect(compared).toMatchObject([{ file: 'messages/de.json', rule: 'missing-key' }]);
});

test.each(CASES)('$check reports $expected.rule and passes after the fix', async (entry) => {
    await using repository = await createTestRepository(REPOSITORY, runGspot, prepareCliRepository);
    const { failed, passed } = await runFindingCase(repository, entry, REPOSITORY);
    expect(failed.code, `${entry.check}: ${failed.stdout}${failed.stderr}`).toBe(1);
    expect(failed.report.checks).toMatchObject([{ check: entry.check, status: 'failed' }]);
    expect(failed.report.checks[0]?.findings).toContainEqual(containing({ check: entry.check, ...entry.expected }));
    expect(passed.code, `${entry.check} corrected: ${passed.stdout}${passed.stderr}`).toBe(0);
    expect(passed.report.checks).toMatchObject([{ check: entry.check, status: 'passed', findings: [] }]);
});
