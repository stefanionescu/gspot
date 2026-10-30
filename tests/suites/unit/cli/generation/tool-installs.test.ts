import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { parse } from '@decimalturn/toml-patch';
import { getTool } from '#cli/manifests/tools.ts';
import { openSession } from '#cli/planning/session.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { generateFiles } from '#cli/generation/generate.ts';
import type { ToolPackageJson } from '#tests/types/packages.ts';
import { YARN_CLIENTS } from '#tests/config/installers/projects.ts';
import { SANDBOX_PACKAGES } from '#tests/config/setup/sandboxes.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import type { PythonToolProject } from '#cli/types/installers/pypi.ts';
import { REACT_NATIVE_DEPENDENCIES } from '#tests/config/generation/samples.ts';
import { STYLESHEET_CASES, LICENSE_TOOL_CASES, REACT_NATIVE_TSCONFIG } from '#tests/config/generation/tool-installs.ts';

test.each([...STYLESHEET_CASES])('$name installs postcss-html when Stylelint is selected', async (row) => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(row.configurations),
        ...row.files,
    });

    const session = await openSession(sandbox.path);
    const packageJsonFile = generateFiles(session).files.find(({ path }) => path === GSPOT_PATHS.npmProject)!;
    expect(
        Object.keys((JSON.parse(packageJsonFile.content) as ToolPackageJson).devDependencies).includes('postcss-html'),
    ).toBe(row.needsHtmlParser);
});

test('a React Native project without Expo installs no Expo or DOM lint plugins', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['typescript', 'react-native']),
        'package.json': JSON.stringify({
            name: 'example',
            private: true,
            dependencies: { ...REACT_NATIVE_DEPENDENCIES, react: SANDBOX_PACKAGES.react },
        }),
        'tsconfig.json': JSON.stringify(REACT_NATIVE_TSCONFIG),
    });

    const session = await openSession(sandbox.path);
    const generated = generateFiles(session).files.find(({ path }) => path === GSPOT_PATHS.npmProject)!;
    const project = JSON.parse(generated.content) as ToolPackageJson;
    expect(project.devDependencies).not.toHaveProperty('eslint-plugin-react-native');
    expect(project.devDependencies).toHaveProperty('@react-native/eslint-plugin');
    expect(project.devDependencies).not.toHaveProperty('eslint-plugin-expo');
    expect(project.devDependencies).not.toHaveProperty('expo-doctor');
    expect(project.devDependencies).not.toHaveProperty('eslint-plugin-jsx-a11y-x');
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
        const generated = generateFiles(session);
        const npmProject = generated.files.find(({ path }) => path === GSPOT_PATHS.npmProject)!;
        expect((JSON.parse(npmProject.content) as ToolPackageJson).devDependencies).toHaveProperty(
            'license-checker-rseidelsohn',
        );
        const pythonProject = generated.files.find(({ path }) => path === GSPOT_PATHS.pythonProject)!;
        expect(
            (parse(pythonProject.content) as { project: PythonToolProject }).project.dependencies.filter((dependency) =>
                dependency.startsWith('pip-licenses'),
            ),
        ).toStrictEqual([]);
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

    const session = await openSession(join(sandbox.path, 'project'));
    const generated = generateFiles(session).files.find(({ path }) => path === GSPOT_PATHS.npmProject);
    expect((JSON.parse(generated!.content) as ToolPackageJson).devDependencies['@next/eslint-plugin-next']).toBe(
        getTool(session.configurationsByName.values(), '@next/eslint-plugin-next').version,
    );
});

test.each([...YARN_CLIENTS])(
    'Yarn $packageManager.version generates an npm tool project without Yarn settings',
    async ({ packageManager }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings([]),
            'package.json': JSON.stringify({ private: true, packageManager: `yarn@${packageManager.version}` }),
        });
        const session = await openSession(sandbox.path);
        const files = generateFiles(session).files;
        expect(files.filter(({ path }) => path.endsWith('.yarnrc.yml')).map(({ path }) => path)).toStrictEqual([]);
        const project = JSON.parse(
            files.find(({ path }) => path === GSPOT_PATHS.npmProject)!.content,
        ) as ToolPackageJson;
        expect(project.devDependencies['prettier']).toBe(
            getTool(session.configurationsByName.values(), 'prettier').version,
        );
    },
);
