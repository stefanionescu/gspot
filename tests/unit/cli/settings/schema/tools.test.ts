import { stringify } from 'smol-toml';
import { test, expect } from 'bun:test';
import { parseSettings } from '#cli/settings/read.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { REFUSED_RULE_OPTIONS } from '#tests/config/settings/errors.ts';

test('zero and false tool options are kept as values', () => {
    const settings = parseSettings(
        stringify({
            configurations: ['css', 'files'],
            tools: {
                stylelint: { rules: { 'max-nesting-depth': 0 } },
                taplo: { extra: { value: { reorder_keys: false }, reason: 'Reviewed in tests.' } },
            },
        }),
        undefined,
        createReadCache(process.cwd()),
    );
    expect(settings.tools).toMatchObject({
        stylelint: { rules: { 'max-nesting-depth': 0 } },
        taplo: { extra: { reorder_keys: false } },
    });
});

test('rule keys named like object properties are checked like any other key', () => {
    for (const key of ['ordinary', 'constructor', 'prototype', 'toString']) {
        expect(() =>
            parseSettings(
                `configurations = ["commits"]\n[tools.commitlint.rules]\n"${key}" = ["invalid"]\n`,
                undefined,
                createReadCache(process.cwd()),
            ),
        ).toThrow(`tools.commitlint.rules.${key}: Unknown commitlint rule. Accepted rules:`);
    }
});
test.each([...REFUSED_RULE_OPTIONS])(
    '$tool rule settings cannot turn rules on or off: $toml',
    ({ configuration, toml, diagnostic }) => {
        expect(() =>
            parseSettings(
                settingsText([configuration], { rules: true, tables: toml }),
                undefined,
                createReadCache(process.cwd()),
            ),
        ).toThrow(diagnostic);
    },
);
