import { expect, test } from 'bun:test';

import { parseConfigurations } from '#cli/manifests/read.ts';
import type { GspotError } from '#cli/system/errors.ts';
import { CONFIGURATION_TABLE, EXAMPLE_MANIFEST_FOLDER, MANIFEST_INVARIANT_CASES } from '#tests/config/manifests.ts';
import { buildConfiguration } from '#tests/setup/cli/manifests.ts';
import { matchFields } from '#tests/setup/matchers.ts';

test('a manifest without [detect] takes the matchers of [files]', () => {
    const tables = '[files]\nfilenames = ["native.project"]\npaths = ["source/**"]\n';
    const inherited = buildConfiguration('native', { tables });
    expect(inherited.detect.filenames).toStrictEqual(['native.project']);
    expect(inherited.detect.paths).toStrictEqual(['source/**']);
    const explicit = buildConfiguration('native', {
        tables: `[detect]\nfilenames = ["explicit.project"]\n${tables}`,
    });
    expect(explicit.detect.filenames).toStrictEqual(['explicit.project']);
    expect(explicit.detect.paths).toStrictEqual([]);
    const empty = buildConfiguration('native', { tables: `[detect]\n${tables}` });
    expect(empty.detect.filenames).toStrictEqual([]);
    expect(empty.detect.paths).toStrictEqual([]);
});

test('a tool name links to the configuration that declares it, listed after the consumer', () => {
    const consumer = {
        folder: 'src/configurations/infrastructure/consumer',
        text: `${CONFIGURATION_TABLE}[[tool]]\nname = "probe"\n`,
    };
    const owner = {
        folder: 'src/configurations/general/owner',
        text: `${CONFIGURATION_TABLE}[[tool]]\nname = "probe"\nsystem = true\n`,
    };
    const configurationsByName = parseConfigurations([consumer, owner]);
    expect(configurationsByName.get('owner')!.tools).toStrictEqual([
        { name: 'probe', kind: 'program', system: true, installers: {} },
    ]);
    expect(configurationsByName.get('consumer')!.tools).toStrictEqual(configurationsByName.get('owner')!.tools);
});

test.each([...MANIFEST_INVARIANT_CASES])('the loader refuses $name and names the field', ({ tables, field }) => {
    const manifests = [{ folder: EXAMPLE_MANIFEST_FOLDER, text: CONFIGURATION_TABLE + tables }];
    expect(() => parseConfigurations(manifests)).toThrow(`\n${field}: `);
});

test('a manifest with invalid TOML names its file and line', () => {
    const manifests = [{ folder: EXAMPLE_MANIFEST_FOLDER, text: `${CONFIGURATION_TABLE}broken = \n` }];
    const position = new RegExp(String.raw`^${EXAMPLE_MANIFEST_FOLDER}/manifest\.toml:\d+:\d+ `, 'u');
    expect(() => parseConfigurations(manifests)).toThrow(
        matchFields<GspotError>({
            name: 'GspotError',
            code: 'parse',
            message: expect.stringMatching(position) as string,
        }),
    );
});

test('a reference to an undeclared tool names the missing tool', () => {
    const manifests = [{ folder: EXAMPLE_MANIFEST_FOLDER, text: `${CONFIGURATION_TABLE}[[tool]]\nname = "absent"\n` }];
    expect(() => parseConfigurations(manifests)).toThrow(/\babsent\b/u);
});
