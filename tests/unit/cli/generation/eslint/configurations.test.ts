import { join } from 'node:path';
import { testdir } from 'testdirs';
import type { Linter } from 'eslint';
import { test, expect } from 'bun:test';
import { pathToFileURL } from 'node:url';
import { openSession } from '#cli/session.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { toolFileFor, createEslint } from '#tests/setup/tool-files.ts';
import type { EslintConfiguration } from '#tests/types/tool-output.ts';
import { MATCHING_SCOPE_FILES, MATCHING_SCOPE_SETTINGS } from '#tests/data/generation/eslint/fragments.ts';

test("a nested scope whose configuration blocks match its parent's gets no copy, and the parent block covers it", async () => {
    await using sandbox = await testdir({
        ...MATCHING_SCOPE_FILES,
        'gspot.toml': buildSandboxSettings(['typescript'], { level: 'all', tables: MATCHING_SCOPE_SETTINGS }),
    });

    const eslint = await createEslint(sandbox.path);
    const session = await openSession(sandbox.path);
    const generated: unknown = await import(pathToFileURL(join(sandbox.path, toolFileFor(session, 'eslint'))).href);
    const { default: blocks } = generated as { default: Linter.Config[] };
    const tests = blocks.filter((block) => block.rules?.['@typescript-eslint/no-non-null-assertion'] === 'off');
    expect(tests).toHaveLength(2);
    const parent = tests.find((block) => block.ignores?.includes('different/**') === true);
    expect(parent?.ignores).toContain('different/**');
    expect(parent?.ignores).not.toContain('same/**');
    expect(parent?.ignores).not.toContain('same/deep/**');
    const same = (await eslint.calculateConfigForFile('same/sample.test.ts')) as EslintConfiguration;
    const different = (await eslint.calculateConfigForFile('different/custom/sample.ts')) as EslintConfiguration;
    const code = (await eslint.calculateConfigForFile('different/src/sample.ts')) as EslintConfiguration;
    expect(same.rules['@typescript-eslint/no-non-null-assertion']?.[0]).toBe(0);
    expect(different.rules['@typescript-eslint/no-non-null-assertion']?.[0]).toBe(0);
    expect(code.rules['@typescript-eslint/no-non-null-assertion']?.[0]).toBe(2);
});
