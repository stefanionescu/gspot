import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { duplicateMisePins } from '#cli/tools/mise.ts';
import { unlinkSync, symlinkSync, writeFileSync } from 'node:fs';
import { parseConfigurationManifest } from '#tests/harness/tooling.ts';
import { DECLARED_TOOLS, DUPLICATE_CASES, MISE_DECLARATIONS } from '#tests/config/cli/tools/mise-pins.ts';

test.each(DUPLICATE_CASES)(
    'duplicate pins name the actual generated file for $runner',
    async ({ runner, names, files }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'mise.toml': MISE_DECLARATIONS });
        const manifest = { ...parseConfigurationManifest('tools'), tools: DECLARED_TOOLS };
        const duplicates = duplicateMisePins(sandbox.path, [manifest], runner);
        expect(duplicates.map((pin) => pin.tool)).toStrictEqual(names);
        expect(duplicates.map((pin) => pin.gspotFile)).toStrictEqual(files);
        expect(duplicates.every((pin) => pin.version !== 'latest')).toBe(true);
        expect(duplicates.some((pin) => pin.tool === 'docker')).toBe(false);
    },
);

test('duplicate pins exclude unconsumed tools and accept mise backend prefixes', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'mise.toml': '[tools]\n"pipx:ruff" = "0.9.0"\nvale = "3.0.0"\n' });
    const ruff = DECLARED_TOOLS.find((tool) => tool.name === 'ruff')!;
    const manifests = [{ ...parseConfigurationManifest('tools'), tools: [ruff] }];
    expect(duplicateMisePins(sandbox.path, manifests, 'none')).toStrictEqual([
        { tool: 'ruff', version: '0.16.8', gspotFile: '.gspot/pyproject.toml' },
    ]);
    writeFileSync(join(sandbox.path, 'mise.toml'), '[settings]\n');
    expect(duplicateMisePins(sandbox.path, manifests, 'mise')).toStrictEqual([]);
});

test('a missing mise file has no duplicate pins and malformed authored TOML fails visibly', async () => {
    await using sandbox = await testdir();
    const manifests = [{ ...parseConfigurationManifest('tools'), tools: DECLARED_TOOLS }];
    expect(duplicateMisePins(sandbox.path, manifests, 'mise')).toStrictEqual([]);
    writeFileSync(join(sandbox.path, 'mise.toml'), '[tools\n');
    expect(() => duplicateMisePins(sandbox.path, manifests, 'mise')).toThrow();
});

test('duplicate pins read a linked authored mise document inside the repository and refuse external links', async () => {
    await using sandbox = await testdir();
    await using outside = await testdir();
    await createFileTree(sandbox.path, { 'settings/mise.toml': MISE_DECLARATIONS });
    await createFileTree(outside.path, { 'mise.toml': MISE_DECLARATIONS });
    const manifests = [{ ...parseConfigurationManifest('tools'), tools: DECLARED_TOOLS }];
    symlinkSync('settings/mise.toml', join(sandbox.path, 'mise.toml'));
    const duplicates = duplicateMisePins(sandbox.path, manifests, 'mise');
    expect(duplicates.map((pin) => pin.tool)).toStrictEqual(['eslint', 'ruff', 'vale', 'uv']);
    unlinkSync(join(sandbox.path, 'mise.toml'));
    symlinkSync(join(outside.path, 'mise.toml'), join(sandbox.path, 'mise.toml'));
    expect(() => duplicateMisePins(sandbox.path, manifests, 'mise')).toThrow('Source link leaves the repository');
    expect(await Bun.file(join(outside.path, 'mise.toml')).text()).toBe(MISE_DECLARATIONS);
});
