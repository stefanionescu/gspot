import { join } from 'node:path';
import { stringify } from 'smol-toml';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { locales } from '#cli/checks/library/i18n.ts';
import { openSession } from '#cli/commands/session.ts';
import { buildCheckInput } from '#tests/harness/input.ts';

test('a missing base locale is reported and restoring it enables key comparisons', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'messages/de.json': '{}' });
    const policy = { configurations: ['i18n'], i18n: { messages_folder: 'messages' } };
    await Bun.write(join(sandbox.path, 'gspot.toml'), stringify({ level: 'all', ...policy }));
    const missing = locales(
        buildCheckInput(await openSession(sandbox.path), 'i18n/locales', { paths: ['messages/de.json'] }),
    );
    expect(missing).toMatchObject([{ file: 'messages/en.json', rule: 'base-locale' }]);
    await Bun.write(join(sandbox.path, 'messages/en.json'), '{"heading":"Welcome"}');
    const compared = locales(
        buildCheckInput(await openSession(sandbox.path), 'i18n/locales', {
            paths: ['messages/de.json', 'messages/en.json'],
        }),
    );
    expect(compared).toMatchObject([{ file: 'messages/de.json', rule: 'missing-key' }]);
});
