import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { planRemoval } from '#cli/ownership/plans.ts';
import { captureThrow } from '#tests/setup/matchers.ts';
import { parse as parseToml } from '@decimalturn/toml-patch';
import { normalizeFileMode } from '#cli/system/files/entries.ts';
import { openWriter, writePlans } from '#cli/ownership/writer.ts';
import { planSettingsWrite } from '#cli/ownership/file-settings.ts';
import { stat, chmod, readFile, writeFile } from 'node:fs/promises';

test('managed TOML keys refuse a malformed file, create missing tables, and write back an edited managed value', async () => {
    await using sandbox = await testdir({ 'broken.toml': '[tasks\n' });

    {
        using writer = openWriter(sandbox.path);
        const changes = [{ key: ['tasks', 'gspot:check', 'run'], value: 'gspot check' }];
        expect(captureThrow(() => planSettingsWrite(writer, 'broken.toml', changes))).toBe(
            'broken.toml:1:7 is not valid TOML: Error parsing TOML (1, 7):. Fix the file.',
        );
        expect(await readFile(join(sandbox.path, 'broken.toml'), 'utf8')).toBe('[tasks\n');
        writePlans(writer, [planSettingsWrite(writer, 'mise.toml', changes)]);
        const installed = await readFile(join(sandbox.path, 'mise.toml'), 'utf8');
        expect(parseToml(installed)).toStrictEqual({ tasks: { 'gspot:check': { run: 'gspot check' } } });
        await writeFile(join(sandbox.path, 'mise.toml'), installed.replace('gspot check', 'authored check'));
        writePlans(writer, [planSettingsWrite(writer, 'mise.toml', changes)]);
        expect(await readFile(join(sandbox.path, 'mise.toml'), 'utf8')).toBe(installed);
    }
});
test('a managed TOML key keeps nearby edits through update and removal', async () => {
    await using sandbox = await testdir();
    const original = '# Keep this comment.\nextends = "./authored.json"\n[compilerOptions]\nstrict = false\n';
    await createFileTree(sandbox.path, { 'compiler.toml': original });
    {
        using writer = openWriter(sandbox.path);
        writePlans(writer, [
            planSettingsWrite(writer, 'compiler.toml', [{ key: ['extends'], value: './.gspot/first.json' }]),
        ]);
        const installed = writer.files.read('compiler.toml')!.bytes.toString('utf8');
        const edited = installed.replace('strict = false', 'strict = true');
        await writeFile(join(sandbox.path, 'compiler.toml'), edited);
        writePlans(writer, [
            planSettingsWrite(writer, 'compiler.toml', [{ key: ['extends'], value: './.gspot/second.json' }]),
        ]);
        expect(writer.files.read('compiler.toml')!.bytes.toString('utf8')).toBe(
            edited.replace('./.gspot/first.json', './.gspot/second.json'),
        );
    }
    {
        using writer = openWriter(sandbox.path);
        writePlans(writer, [planRemoval(writer, 'compiler.toml')]);
        expect(writer.files.read('compiler.toml')!.bytes.toString('utf8')).toBe(
            original.replace('strict = false', 'strict = true').replace('./authored.json', './.gspot/second.json'),
        );
    }
});

test('adopting identical TOML keys and removing them keeps the bytes and mode', async () => {
    await using sandbox = await testdir();
    const content = 'authored = true\n[scripts]\ncheck = "gspot check"\n';
    await createFileTree(sandbox.path, { 'package.toml': content });
    await chmod(join(sandbox.path, 'package.toml'), 0o640);
    {
        using writer = openWriter(sandbox.path);
        writePlans(writer, [
            planSettingsWrite(writer, 'package.toml', [{ key: ['scripts', 'check'], value: 'gspot check' }]),
        ]);
        writePlans(writer, [planRemoval(writer, 'package.toml')]);
        expect(await readFile(join(sandbox.path, 'package.toml'), 'utf8')).toBe(content);
        const metadata = await stat(join(sandbox.path, 'package.toml'));
        expect(metadata.mode & 0o777).toBe(normalizeFileMode({ mode: 0o640 }));
    }
});
