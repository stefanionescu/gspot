import { test, expect } from 'bun:test';
import { buildManifest } from '#tests/setup/manifest.ts';
import { REPLACE_DECLARATION } from '#tests/config/manifests.ts';
import { toolDeclarationSchema } from '#cli/configurations/schema/tool.ts';

test.each([
    {
        name: 'a key without shared ownership',
        selection: 'key = "eslintConfig"',
        message: 'A selected key or table must preserve its shared file.',
    },
    {
        name: 'a table without shared ownership',
        selection: 'table = "tool.ruff"',
        message: 'A selected key or table must preserve its shared file.',
    },
    {
        name: 'both a key and a table',
        selection: 'key = "eslintConfig"\ntable = "tool.ruff"\nshared = true',
        message: 'A replace row selects either a key or a table.',
    },
])('a replace row refuses $name', ({ selection, message: diagnostic }) => {
    expect(() =>
        buildManifest('example', {
            tables: REPLACE_DECLARATION + selection,
        }),
    ).toThrow(diagnostic);
});

test('replacement records keep shared sections and refuse invalid items', () => {
    const tables =
        '[[tool]]\nname = "native"\nversion = "1.0.0"\nreplace = [{ file = ".native" }, { file = "native.json" }, { file = "package.json", key = "native", shared = true }]\n';
    const declaration = buildManifest('native', { tables }).tools[0]!;
    if (typeof declaration === 'string') throw new Error('The fixture must declare native.');
    expect(declaration.replace).toStrictEqual([
        { file: '.native', shared: false },
        { file: 'native.json', shared: false },
        { file: 'package.json', key: 'native', shared: true },
    ]);
    for (const invalid of ['".native"', '[{ file = "" }]', '[{ file = 7 }]']) {
        expect(() =>
            buildManifest('native', {
                tables: tables.replace(
                    '[{ file = ".native" }, { file = "native.json" }, { file = "package.json", key = "native", shared = true }]',
                    invalid,
                ),
            }),
        ).toThrow('replace');
    }
});

test('a tool declaration refuses unknown fields', () => {
    expect(toolDeclarationSchema.safeParse('probe').success).toBe(false);
    expect(toolDeclarationSchema.safeParse({ name: 'probe', mystery: true }).success).toBe(false);
    const tool = toolDeclarationSchema.parse({ name: 'probe', version: '1.0.0', npm: 'native-probe' });
    expect(tool).toMatchObject({
        name: 'probe',
        kind: 'program',
        installers: { npm: { name: 'native-probe', version: '1.0.0' } },
    });
});
