import { expect, test } from 'bun:test';

import { planChecks } from '#cli/engine/plan/checks.ts';
import { openSession } from '#cli/engine/session.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test.each([
    { name: 'one root config', files: { 'vitest.config.mjs': '' }, scopes: [''] },
    {
        name: 'a config in each package',
        files: { 'a/vitest.config.mjs': '', 'b/vitest.config.mjs': '' },
        scopes: ['a', 'b'],
    },
    {
        name: 'a root config and one package config',
        files: { 'vitest.config.mjs': '', 'b/vitest.config.mjs': '' },
        scopes: ['', 'b'],
    },
])('vitest runs only where a test config sits, with $name', async ({ files, scopes }) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': `configurations = ["vitest"]\n\n[[scope]]\npath = "a"\nconfigurations = ["vitest"]\n\n[[scope]]\npath = "b"\nconfigurations = ["vitest"]\n`,
        'a/a.test.js': '',
        'b/b.test.js': '',
        ...files,
    });
    const planned = planChecks(await openSession(sandbox.path), { stage: 'push', only: ['vitest/tests'] });
    expect(planned.map(({ scope }) => scope.path)).toStrictEqual([...scopes]);
});
