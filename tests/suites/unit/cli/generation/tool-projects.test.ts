import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { getTool } from '#cli/configurations/tools.ts';
import { generate } from '#cli/generation/generate.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { buildNpmProject } from '#cli/generation/tool-projects.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import testsPackage from '#tests/package.json' with { type: 'json' };
import { parseToolPackageJson } from '#cli/install/npm/package-json.ts';
import { REACT_NATIVE_DEPENDENCIES } from '#tests/config/generation/samples.ts';
import { isYarnBerry, assertPackageManager } from '#cli/repository/npm/package-manager.ts';

import {
    YARN_CLIENTS,
    STYLESHEET_CASES,
    NEXT_REQUIREMENTS,
    LICENSE_TOOL_CASES,
    NEXTJS_API_SETTINGS,
    REACT_NATIVE_TSCONFIG,
} from '#tests/config/generation/tool-projects.ts';

test.each([...STYLESHEET_CASES])(
    '$name installs postcss-html only when Stylelint reads Vue or Svelte styles',
    async (row) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(row.configurations),
            ...row.files,
        });

        const session = await openSession(sandbox.path);
        const packageJsonFile = generate(session).files.find(({ path }) => path === GSPOT_PATHS.npmProject)!;
        expect(
            Object.keys(
                parseToolPackageJson(packageJsonFile.content, assertPackageManager(session.packageManager).name)
                    .dependencies,
            ).includes('postcss-html'),
        ).toBe(row.needsHtmlParser);
    },
);

test('a React Native project without Expo installs no Expo or DOM lint plugins', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['typescript', 'react-native']),
        'package.json': JSON.stringify({
            name: 'example',
            private: true,
            dependencies: { ...REACT_NATIVE_DEPENDENCIES, react: testsPackage.devDependencies.react },
        }),
        'tsconfig.json': JSON.stringify(REACT_NATIVE_TSCONFIG),
    });

    const session = await openSession(sandbox.path);
    const generated = generate(session).files.find(({ path }) => path === GSPOT_PATHS.npmProject)!;
    const project = parseToolPackageJson(generated.content, assertPackageManager(session.packageManager).name);
    expect(project.dependencies).toHaveProperty('eslint-plugin-react-native');
    expect(project.dependencies).not.toHaveProperty('eslint-plugin-expo');
    expect(project.dependencies).not.toHaveProperty('expo-doctor');
    expect(project.dependencies).not.toHaveProperty('eslint-plugin-jsx-a11y');
});

test.each([...LICENSE_TOOL_CASES])(
    'a root allowed package installs the license tool for a child scope with root configurations $configurations',
    async ({ configurations }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings([...configurations], {
                tables: '[[licenses.allowed_package]]\nname = "example"\nversion = "1.0.0"\nreason = "Reviewed installed metadata."\n',
                scopes: [{ path: 'docs', configurations: ['licenses'] }],
            }),
            'docs/package.json': '{"name":"docs","private":true}',
        });
        const session = await openSession(sandbox.path);
        const generated = generate(session);
        const npmProject = generated.files.find(({ path }) => path === GSPOT_PATHS.npmProject)!;
        expect(
            parseToolPackageJson(npmProject.content, assertPackageManager(session.packageManager).name).dependencies,
        ).toHaveProperty('license-checker-rseidelsohn');
        expect(generated.files.find(({ path }) => path === GSPOT_PATHS.pythonProject)).toBeUndefined();
    },
);

test.each([...YARN_CLIENTS])(
    'Yarn $packageManager.version gets the matching tool project settings',
    ({ packageManager, settings }) => {
        const files = buildNpmProject({
            configurations: [],
            packageManager: isYarnBerry(packageManager) ? 'yarn' : 'npm',
        });
        expect(files.map((file) => file.path)).toStrictEqual(
            settings ? [GSPOT_PATHS.npmProject, GSPOT_PATHS.yarnSettings] : [GSPOT_PATHS.npmProject],
        );
        if (settings) expect(files[1]!.content).toBe('nodeLinker: node-modules\nenableGlobalCache: true\n');
    },
);

test.each([...NEXT_REQUIREMENTS])(
    'Next ESLint plugin keeps its shipped pin across project versions: $name',
    async (row) => {
        await using sandbox = await testdir({
            'project/gspot.toml': buildSandboxSettings(['nextjs'], {
                scopes: [{ path: 'app/client', configurations: ['nextjs'] }],
            }),
            'project/package.json': JSON.stringify({ private: true, dependencies: { next: row.rootRange } }),
            'project/app/client/source.ts': 'export const count = 1;\n',
            'node_modules/next/package.json': '{"name":"next","version":"17.0.0"}',
            ...(row.childRange === undefined
                ? {}
                : {
                      'project/app/package.json': JSON.stringify({
                          private: true,
                          dependencies: { next: row.childRange },
                      }),
                  }),
            ...(row.rootVersion === undefined
                ? {}
                : {
                      'project/node_modules/next/package.json': JSON.stringify({
                          name: 'next',
                          version: row.rootVersion,
                      }),
                  }),
            ...(row.childVersion === undefined
                ? {}
                : {
                      'project/app/node_modules/next/package.json': JSON.stringify({
                          name: 'next',
                          version: row.childVersion,
                      }),
                  }),
        });

        const session = await openSession(join(sandbox.path, 'project'));
        const generated = generate(session).files.find(({ path }) => path === GSPOT_PATHS.npmProject);
        expect(
            parseToolPackageJson(generated!.content, assertPackageManager(session.packageManager).name).dependencies[
                '@next/eslint-plugin-next'
            ],
        ).toBe(getTool(session.configurations.values(), '@next/eslint-plugin-next').version);
    },
);

test('Next.js scopes keep one manifest plugin pin', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript'], NEXTJS_API_SETTINGS),
        'package.json': '{"private":true,"packageManager":"bun@1.4.2"}',
        'web/package.json': '{"dependencies":{"next":"^16.3.6"}}',
        'api/package.json': '{"dependencies":{"next":"^15.5.9"}}',
        'web/node_modules/next/package.json': '{"name":"next","version":"16.3.6"}',
        'api/node_modules/next/package.json': '{"name":"next","version":"15.5.9"}',
    });

    const session = await openSession(sandbox.path);
    const output = generate(session).files.find(({ path }) => path === GSPOT_PATHS.npmProject);
    expect(
        parseToolPackageJson(output!.content, assertPackageManager(session.packageManager).name).dependencies[
            '@next/eslint-plugin-next'
        ],
    ).toBe(getTool(session.configurations.values(), '@next/eslint-plugin-next').version);
});
