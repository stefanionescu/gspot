import prettier from 'prettier';
import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { run } from '#tests/support/cli/command.ts';
import type { ApplyPreviewJson } from '#cli/types/commands/apply.ts';
import { chmodSync, readFileSync, statSync, writeFileSync } from 'node:fs';

const POLICY = 'version = 1\nconfigurations = ["formatting"]\n[rules]\ninstall = false\n';
const SOURCE = 'const greeting="hello";if(greeting){console.log(greeting);}';
const EXPECTED = 'const greeting = "hello"\nif (greeting) {\n        console.log(greeting)\n}\n';

test.each([
    ['.prettierrc.json5', '{semi: false, tabWidth: 8,}\n'],
    ['prettier.config.ts', "export default { semi: false, tabWidth: 8 } satisfies import('prettier').Config;\n"],
    ['package.yaml', 'private: true\nprettier:\n  semi: false\n  tabWidth: 8\n'],
    ['.prettierrc.yaml', 'semi: false\ntabWidth: 8\n'],
    ['.prettierrc.json', '{"semi":false,"tabWidth":8}\n'],
    ['prettier.config.mjs', 'export default { semi: false, tabWidth: 8 };\n'],
    ['package.json', '{"private":true,"prettier":{"semi":false,"tabWidth":8}}\n'],
])('apply preserves active authored %s despite source exclusions and keeps future formatting', async (path, text) => {
    await using repository = await testdir();
    await createFileTree(repository.path, {
        'gspot.toml': POLICY.replace('[rules]', `exclude = ${JSON.stringify([path])}\n[rules]`),
        [path]: text,
        'source.js': SOURCE,
    });
    const original = join(repository.path, path);
    chmodSync(original, 0o640);
    const filepath = join(repository.path, 'source.js');
    const before = await prettier.resolveConfig(filepath, { editorconfig: true, useCache: false });
    expect(await prettier.format(SOURCE, { ...before, filepath })).toBe(EXPECTED);
    const preview = await run(repository.path, ['apply', '--dry-run', '--json']);
    expect(preview.code, preview.stdout + preview.stderr).toBe(0);
    expect((JSON.parse(preview.stdout) as ApplyPreviewJson).notes.join('\n')).toContain(
        `retained ${path}: editor configuration remains active`,
    );
    const applied = await run(repository.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    expect(applied.stdout).toContain(`retained ${path}: editor configuration remains active`);
    expect(readFileSync(original, 'utf8')).toBe(text);
    expect(statSync(original).mode & 0o777).toBe(0o640);
    for (const file of ['source.js', 'future.js']) {
        const filePath = join(repository.path, file);
        if (file === 'future.js') writeFileSync(filePath, SOURCE);
        const options = await prettier.resolveConfig(filePath, { editorconfig: true, useCache: false });
        expect(await prettier.format(SOURCE, { ...options, filepath: filePath })).toBe(EXPECTED);
        expect(readFileSync(filePath, 'utf8')).toBe(SOURCE);
    }
    const repeated = await run(repository.path, ['apply', '--dry-run', '--json']);
    expect(repeated.code, repeated.stdout + repeated.stderr).toBe(0);
    expect((JSON.parse(repeated.stdout) as ApplyPreviewJson).drift).toStrictEqual([]);
});

test('apply removes its owned pointers when an authored formatter configuration is introduced', async () => {
    await using repository = await testdir();
    await createFileTree(repository.path, { 'gspot.toml': POLICY, 'source.js': SOURCE });
    const initial = await run(repository.path, ['apply']);
    expect(initial.code, initial.stdout + initial.stderr).toBe(0);
    const filepath = join(repository.path, 'source.js');
    const text = 'export default { semi: false, tabWidth: 8 };\n';
    writeFileSync(join(repository.path, 'prettier.config.mjs'), text);
    const masked = await prettier.resolveConfig(filepath, { editorconfig: true, useCache: false });
    expect(await prettier.format(SOURCE, { ...masked, filepath })).not.toBe(EXPECTED);
    const applied = await run(repository.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const options = await prettier.resolveConfig(filepath, { editorconfig: true, useCache: false });
    expect(await prettier.format(SOURCE, { ...options, filepath })).toBe(EXPECTED);
    expect(readFileSync(join(repository.path, 'prettier.config.mjs'), 'utf8')).toBe(text);
    const repeated = await run(repository.path, ['apply', '--dry-run', '--json']);
    expect(repeated.code, repeated.stdout + repeated.stderr).toBe(0);
    expect((JSON.parse(repeated.stdout) as ApplyPreviewJson).drift).toStrictEqual([]);
});
