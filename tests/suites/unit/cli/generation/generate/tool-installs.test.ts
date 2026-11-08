import { join } from 'node:path';

import { expect, test } from 'bun:test';
import { testdir } from 'testdirs';

import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { openSession } from '#cli/engine/session.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { getTool } from '#cli/tools/pins.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { runGitStep } from '#tests/setup/system/git.ts';
import type { ToolPackageJson } from '#tests/types/setup.ts';

test('a plugin package joins the tool project at its pin, and a tracked plugin module does not', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['css', 'javascript'], {
            tables: '[[tools.eslint.plugins]]\nname = "acme"\npackage = "eslint-plugin-acme"\nversion = "1.2.3"\nrules = { no-legacy = [] }\n[[tools.eslint.plugins]]\nname = "local"\npath = "plugin.mjs"\nrules = {}\n[[tools.stylelint.plugins]]\npackage = "stylelint-acme"\nversion = "4.5.6"\nrules = { "acme/no-red" = true }\n',
        }),
        'package.json': '{"private":true,"type":"module"}\n',
        'plugin.mjs': 'export default { rules: {} };\n',
        'a.css': 'a { color: blue; }\n',
    });
    const session = await openSession(sandbox.path);
    const project = buildGeneratedFiles(session).files.find(({ path }) => path === GSPOT_PATHS.npmProject)!;
    const { devDependencies } = JSON.parse(project.content) as ToolPackageJson;
    expect(devDependencies).toMatchObject({ 'eslint-plugin-acme': '1.2.3', 'stylelint-acme': '4.5.6' });
});

test('Next ESLint plugin keeps its shipped pin when two folders declare different majors', async () => {
    await using sandbox = await testdir({
        'project/gspot.toml': buildSandboxSettings(['nextjs'], {
            scopes: [{ path: 'app/client', configurations: ['nextjs'] }],
        }),
        'project/package.json': '{"private":true,"dependencies":{"next":"^16.3.6"}}',
        'project/app/package.json': '{"private":true,"dependencies":{"next":"^15.5.9"}}',
        'project/app/client/source.ts': 'export const count = 1;\n',
        'node_modules/next/package.json': '{"name":"next","version":"17.0.0"}',
    });

    runGitStep(join(sandbox.path, 'project'), ['init', '--quiet']);
    const session = await openSession(join(sandbox.path, 'project'));
    const generated = buildGeneratedFiles(session).files.find(({ path }) => path === GSPOT_PATHS.npmProject);
    expect((JSON.parse(generated!.content) as ToolPackageJson).devDependencies['@next/eslint-plugin-next']).toBe(
        getTool(readConfigurations().values(), '@next/eslint-plugin-next').version,
    );
});
