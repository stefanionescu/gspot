import { stringify } from 'smol-toml';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { parseSettings } from '#cli/settings/read.ts';
import { emitSettings, parseTomlText } from '#cli/settings/file.ts';
import { settingsSchema } from '#cli/settings/schema/gspot-toml.ts';
import { UNTIL_DATE_CASES, UNSAFE_DIRECTORIES } from '#tests/config/settings/schema.ts';

for (const row of UNTIL_DATE_CASES)
    test(`${row.name}: the until date of an ignore must be a TOML date`, () => {
        const source = `configurations = ["bash"]\n[[ignore]]\ncheck="bash/shellcheck"\nreason="Reviewed in tests."\nuntil=${row.literal}\n`;
        const written = parseTomlText(source, 'dates.toml', 'settings');
        expect(settingsSchema.safeParse(written).success).toBe(row.valid);
        if (!row.valid) return;
        const settings = parseSettings(source);
        expect(settings.ignore[0]?.until?.toISOString()).toBe(row.date);
        const output = emitSettings(source, written);
        expect(output).toContain(`until = ${row.date}`);
        expect(emitSettings(output, parseTomlText(output, 'dates.toml', 'settings'))).toBe(output);
    });

test.each([...UNSAFE_DIRECTORIES])('scope refuses the path %s', (path) => {
    expect(() => parseSettings(stringify({ scope: [{ path }] }))).toThrow(
        'Use a relative path with forward slashes, without parent traversal or a drive prefix.',
    );
});

test('relative folders with spaces, percent signs and Unicode are accepted', async () => {
    const path = 'apps/café 100%';
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { [`${path}/source.ts`]: 'export const count = 1;\n' });
    expect(Object.keys(parseSettings(stringify({ scope: [{ path }] }), sandbox.path).scope)).toStrictEqual([path]);
});
