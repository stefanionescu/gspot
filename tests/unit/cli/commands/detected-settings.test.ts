import { expect, test } from 'bun:test';
import type { Detect } from '#cli/types/commands/init.ts';
import { detectedSettings } from '#cli/commands/init/settings.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import type { ManifestFacts, TrackedFile } from '#cli/types/repository/repository.ts';

const manifests = configurationManifests();
const selected = (...names: string[]) => names.map((name) => manifests.get(name)!);
const file = (path: string): TrackedFile => ({
    path,
    prefix: Buffer.alloc(0),
    nature: 'source',
    tags: ['text'],
    executable: false,
    size: 1,
});
const facts = (dependencies: Record<string, string>): ManifestFacts => ({
    path: 'package.json',
    kind: 'package.json',
    dependencies,
    installed: dependencies,
    scripts: {},
    workspaces: [],
    engines: {},
});

test('a dependency turns a boolean setting on, and its absence leaves the setting to its default', () => {
    const nestjs = selected('nestjs');
    expect(
        detectedSettings(nestjs, [facts({ '@nestjs/core': '11.0.0', '@nestjs/swagger': '11.0.0' })], []),
    ).toStrictEqual([{ key: 'tools.nestjs.swagger', value: true, configuration: 'nestjs' }]);
    expect(detectedSettings(nestjs, [facts({ '@nestjs/core': '11.0.0' })], [])).toStrictEqual([]);
});

test('the first folder that exists names the types directory', () => {
    const structure = selected('structure');
    expect(detectedSettings(structure, [], [file('src/types/user.ts'), file('src/index.ts')])).toStrictEqual([
        { key: 'architecture.types_directory', value: 'src/types', configuration: 'structure' },
    ]);
    expect(detectedSettings(structure, [], [file('types/user.ts'), file('src/types/other.ts')])).toMatchObject([
        { value: 'types' },
    ]);
    expect(detectedSettings(structure, [], [file('src/index.ts')])).toStrictEqual([]);
});

test('a dependency or a folder names the SQL dialect, and the first declaration of a setting wins', () => {
    const sql = selected('sql', 'postgres');
    expect(detectedSettings(sql, [facts({ mysql2: '3.0.0' })], [])).toStrictEqual([
        { key: 'tools.sqlfluff.dialect', value: 'mysql', configuration: 'sql' },
    ]);
    expect(detectedSettings(sql, [facts({})], [file('supabase/config.toml')])).toMatchObject([{ value: 'postgres' }]);
    expect(detectedSettings(sql, [facts({ express: '5.0.0' })], [file('src/app.ts')])).toStrictEqual([]);
});

test.each([
    { detect: { dependency: 'present', dependencies: { present: false } }, expected: [true] },
    { detect: { dependencies: { present: false }, folders: ['src'] }, expected: [false] },
    { detect: { dependencies: { present: undefined }, folders: ['src'] }, expected: [] },
    { detect: { folders: ['src'], folder_values: { src: false } }, expected: ['src'] },
    { detect: { folder_values: { src: false, other: true } }, expected: [false] },
] satisfies { detect: Detect; expected: unknown[] }[])(
    'setting detection preserves priority and values for %j',
    ({ detect, expected }) => {
        const manifest = manifests.get('nestjs')!;
        const setting = manifest.settings.find((entry) => entry.name === 'tools.nestjs.swagger')!;
        const selected = { ...manifest, settings: [{ ...setting, detect }] };
        expect(detectedSettings([selected], [facts({ present: '1.0.0' })], [file('src/entry.ts')])).toStrictEqual(
            expected.map((value) => ({ key: setting.name, value, configuration: 'nestjs' })),
        );
    },
);

test('an unmatched declaration leaves a later setting eligible while a matched false value claims it', () => {
    const manifest = manifests.get('nestjs')!;
    const setting = manifest.settings.find((entry) => entry.name === 'tools.nestjs.swagger')!;
    const first = { ...manifest, settings: [{ ...setting, detect: { dependency: 'absent' } }] };
    const second = { ...manifest, settings: [{ ...setting, detect: { dependencies: { present: false } } }] };
    const third = { ...manifest, settings: [{ ...setting, detect: { dependency: 'present' } }] };
    expect(detectedSettings([first, second, third], [facts({ present: '1.0.0' })], [])).toStrictEqual([
        { key: setting.name, value: false, configuration: 'nestjs' },
    ]);
});
