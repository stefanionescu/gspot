import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildEslint, listLintFindings } from '#tests/setup/eslint/lint.ts';

test('Svelte parser errors restore the working folder for JavaScript', async () => {
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

test('a Svelte component reports what the rules read from the imports of its script', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['svelte']),
        'package.json': '{"private":true,"type":"module","dependencies":{"svelte":"^5.0.0"}}',
        'Wallet.svelte':
            '<script>\nimport { Wallet } from "ethers";\nexport const wallet = Wallet.fromPhrase("legal winner thank year");\n</script>\n<p>Wallet</p>\n',
    });
    const eslint = await buildEslint(sandbox.path);
    expect(
        await listLintFindings(eslint, sandbox.path, ['Wallet.svelte'], ['gspot/review-blockchain-mnemonic']),
    ).toStrictEqual([{ file: 'Wallet.svelte', rule: 'gspot/review-blockchain-mnemonic', line: 3 }]);
});
