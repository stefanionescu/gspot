import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { getTool } from '#cli/tools/pins.ts';
import { openSession } from '#cli/engine/session.ts';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { runGitStep } from '#tests/setup/system/git.ts';
import type { ToolPackageJson } from '#tests/types/setup.ts';
import { YARN_CLIENTS } from '#tests/config/setup/programs.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { STYLESHEET_CASES, LICENSE_TOOL_CASES } from '#tests/config/generation/generate.ts';

test.each([...STYLESHEET_CASES])('$name installs postcss-html when Stylelint is selected', async (row) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(row.configurations),
        ...row.files,
    });

    const session = await openSession(sandbox.path);
    const packageJsonFile = buildGeneratedFiles(session).files.find(({ path }) => path === GSPOT_PATHS.npmProject)!;
    expect(
        Object.keys((JSON.parse(packageJsonFile.content) as ToolPackageJson).devDependencies).includes('postcss-html'),
    ).toBe(row.needsHtmlParser);
});

test.each([...LICENSE_TOOL_CASES])(
    'a root allowed package installs the license tool for a child scope with root configurations $configurations',
    async ({ configurations }) => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings([...configurations], {
                tables: '[[licenses.allowed_package]]\nname = "example"\nversion = "1.0.0"\nreason = "Reviewed installed metadata."\n[[scope]]\npath = "docs"\nconfigurations = ["licenses"]\n[scope.licenses]\nallowed = ["MIT"]\n',
            }),
            'docs/package.json': '{"name":"docs","private":true}',
        });
        const session = await openSession(sandbox.path);
        const generated = buildGeneratedFiles(session);
        const npmProject = generated.files.find(({ path }) => path === GSPOT_PATHS.npmProject)!;
        expect((JSON.parse(npmProject.content) as ToolPackageJson).devDependencies).toHaveProperty(
            'license-checker-rseidelsohn',
        );
        expect(generated.files.find(({ path }) => path === GSPOT_PATHS.pythonProject)).toBeUndefined();
    },
);

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
        getTool(session.configurationsByName.values(), '@next/eslint-plugin-next').version,
    );
});

test.each([...YARN_CLIENTS])(
    'Yarn $packageManager.version generates an npm tool project without Yarn settings',
    async ({ packageManager }) => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings([]),
            'package.json': JSON.stringify({ private: true, packageManager: `yarn@${packageManager.version}` }),
        });
        const session = await openSession(sandbox.path);
        const files = buildGeneratedFiles(session).files;
        expect(files.filter(({ path }) => path.endsWith('.yarnrc.yml')).map(({ path }) => path)).toStrictEqual([]);
    },
);
