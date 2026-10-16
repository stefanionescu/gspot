import { test, expect } from 'bun:test';
import { buildManifest } from '#tests/setup/manifest.ts';
import { REPLACE_DECLARATION } from '#tests/config/manifests.ts';
import { toolDeclarationSchema } from '#cli/configurations/schema/tool.ts';

test('a replace_key record refuses both a key and a table', () => {
    expect(() =>
        buildManifest('example', { tables: REPLACE_DECLARATION + 'key = "eslintConfig"\ntable = "tool.ruff"\n' }),
    ).toThrow('A replace_key record selects one key or table.');
});

test('replacement lists keep owned files and shared sections and refuse invalid items', () => {
    const tables =
        '[[tool]]\nname = "native"\nversion = "1.0.0"\nreplace = [".native", "native.json"]\n[[tool.replace_key]]\nfile = "package.json"\nkey = "native"\n';
    const declaration = buildManifest('native', { tables }).tools[0]!;
    if (typeof declaration === 'string') throw new Error('The fixture must declare native.');
    expect(declaration.replace).toStrictEqual(['.native', 'native.json']);
    expect(declaration.replace_key).toStrictEqual([{ file: 'package.json', key: 'native' }]);
    for (const invalid of ['".native"', '[""]', '[7]']) {
        expect(() =>
            buildManifest('native', { tables: tables.replace('[".native", "native.json"]', invalid) }),
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
