import { join } from 'node:path';
import { chmodSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { readRepository } from '#cli/repository/tree.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { detectConfigurations, unknownLanguages } from '#cli/configurations/detect.ts';

describe('tags', () => {
    test('tags come from extension, filename, shebang and content', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            hook: '#!/usr/bin/env bash\necho hi\n',
            'a.png': Buffer.from([0x89, 0x50, 0, 0]).toString('binary'),
            Dockerfile: 'FROM x\n',
            'binary.js': 'text\0binary',
        });
        chmodSync(join(sandbox.path, 'hook'), 0o755);
        const repository = await readRepository(sandbox.path, [], [], []);
        const files = new Map(repository.files.map((file) => [file.path, file]));
        const hook = files.get('hook')!;
        if (process.platform !== 'win32') expect(hook.tags).toContain('executable');
        for (const tag of ['shell', 'shebang:shell', 'text']) expect(hook.tags).toContain(tag);
        expect(files.get('a.png')!.nature).toBe('binary');
        expect(files.get('binary.js')!.nature).toBe('binary');
        expect(files.get('Dockerfile')!.tags).toContain('dockerfile');
    });
});

test('Vue and Svelte keep source tags while unsupported JVM languages remain detectable', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'View.vue': '<template><p>Ready</p></template>\n',
        'View.svelte': '<p>Ready</p>\n',
        'Main.kt': 'fun main() {}\n',
        'Main.java': 'class Main {}\n',
    });
    const repository = await readRepository(sandbox.path, [], [], []);
    const files = new Map(repository.files.map((file) => [file.path, file]));
    for (const language of ['vue', 'svelte']) {
        const component = files.get(`View.${language}`)!;
        expect(component.nature).toBe('source');
        for (const tag of [language, 'source', 'text']) expect(component.tags).toContain(tag);
    }
    const manifests = configurationManifests();
    expect(unknownLanguages(repository.files, manifests)).toStrictEqual([
        { language: 'Java', extensions: ['.java'], count: 1 },
        { language: 'Kotlin', extensions: ['.kt'], count: 1 },
    ]);
    const selected = detectConfigurations(repository.files, manifests, []).map((entry) => entry.configuration);
    expect(selected).toContain('vue');
    expect(selected).toContain('svelte');
    expect(selected).not.toContain('java');
    expect(selected).not.toContain('kotlin');
});
