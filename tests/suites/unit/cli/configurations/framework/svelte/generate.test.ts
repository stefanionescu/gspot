import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';
import { testdir } from 'testdirs';

import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildEslint } from '#tests/setup/eslint/lint.ts';

test.each(['JavaScript'])('Svelte parser errors restore the working folder for %s', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['svelte']),
        'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["**/*"]}',
        'Card.svelte': '<script>const value = ;</script><p>Hello</p>',
    });
    const previousFolder = process.cwd();
    const eslint = await buildEslint(sandbox.path);
    const [invalid] = await eslint.lintFiles(['Card.svelte']);
    expect(invalid?.fatalErrorCount).toBe(1);
    expect(process.cwd()).toBe(previousFolder);
    await writeFile(join(sandbox.path, 'Card.svelte'), '<p>Hello</p>');
    const [corrected] = await eslint.lintFiles(['Card.svelte']);
    expect(corrected?.fatalErrorCount).toBe(0);
    expect(process.cwd()).toBe(previousFolder);
});
