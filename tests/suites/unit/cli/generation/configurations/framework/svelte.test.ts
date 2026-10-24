import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { createEslint } from '#tests/setup/eslint/lint.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';

test.each(['JavaScript', 'TypeScript'])('Svelte parser errors restore the working folder for %s', async (language) => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(language === 'TypeScript' ? ['svelte', 'typescript'] : ['svelte']),
        'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["**/*"]}',
        'Card.svelte': '<script>const value = ;</script><p>Hello</p>',
    });
    const previousFolder = process.cwd();
    const eslint = await createEslint(sandbox.path);
    const [invalid] = await eslint.lintFiles(['Card.svelte']);
    expect(invalid?.fatalErrorCount).toBe(1);
    expect(process.cwd()).toBe(previousFolder);
    await writeFile(join(sandbox.path, 'Card.svelte'), '<p>Hello</p>');
    const [corrected] = await eslint.lintFiles(['Card.svelte']);
    expect(corrected?.fatalErrorCount).toBe(0);
    expect(process.cwd()).toBe(previousFolder);
});
