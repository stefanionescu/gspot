import { test, expect } from 'bun:test';
import { parseSettings } from '#cli/settings/read.ts';
import { createReadCache } from '#cli/system/files/cache.ts';

test('module import edges name declared module and preserve authored absence', () => {
    const text = `[[architecture.module]]
name = "app"
paths = ["app/**"]
may_import = ["storage"]

[[architecture.module]]
name = "storage"
paths = ["storage/**"]
`;
    const settings = parseSettings(text, undefined, createReadCache(process.cwd()));
    expect(settings.architecture.module).toStrictEqual([
        { name: 'app', paths: ['app/**'], may_import: ['storage'] },
        { name: 'storage', paths: ['storage/**'], may_import: [] },
    ]);
    expect(settings.written).toMatchObject({ architecture: { module: [{ name: 'app' }, { name: 'storage' }] } });
    expect(settings.written).not.toHaveProperty('architecture.module.1.may_import');
    expect(() =>
        parseSettings(
            text.replace('may_import = ["storage"]', 'may_import = ["missing"]'),
            undefined,
            createReadCache(process.cwd()),
        ),
    ).toThrow('architecture.module.0.may_import.0');
    expect(() =>
        parseSettings(text.replace('paths = ["app/**"]', 'paths = [3]'), undefined, createReadCache(process.cwd())),
    ).toThrow('architecture.module.0.paths.0');
});
