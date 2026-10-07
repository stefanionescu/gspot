import { join } from 'node:path';
import { stringify } from 'smol-toml';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { locales } from '#cli/checks/library/i18n.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { buildCheckInput } from '#tests/harness/input.ts';
import { relations } from '#cli/checks/library/drizzle.ts';

test('a missing base locale is reported and restoring it enables key comparisons', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'messages/de.json': '{}' });
    const policy = { configurations: ['i18n'], i18n: { locales: { directory: 'messages', base: 'en' } } };
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

test('named-schema Drizzle tables need relations and comments do not satisfy the requirement', async () => {
    await using sandbox = await testdir();
    const schema =
        'const schema = pgSchema("teams");\nexport const members = schema.table("members", { teamId: uuid().references(() => teams.id) });\n// relations(members, () => ({}))\n';
    await createFileTree(sandbox.path, { 'schema.ts': schema });
    await Bun.write(join(sandbox.path, 'gspot.toml'), buildPolicy(['drizzle'], { level: 'all' }));
    const input = buildCheckInput(await openSession(sandbox.path), 'drizzle/relations', { paths: ['schema.ts'] });
    expect(relations(input)).toMatchObject([{ file: 'schema.ts', line: 2, rule: 'relations' }]);
    await Bun.write(
        join(sandbox.path, 'schema.ts'),
        `${schema}\nexport const memberRelations = relations(members, () => ({}));\n`,
    );
    await Bun.write(join(sandbox.path, 'gspot.toml'), buildPolicy(['drizzle'], { level: 'all' }));
    const corrected = buildCheckInput(await openSession(sandbox.path), 'drizzle/relations', { paths: ['schema.ts'] });
    expect(relations(corrected)).toStrictEqual([]);
});
