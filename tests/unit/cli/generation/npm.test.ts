import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/session.ts';
import { generate } from '#cli/generation/generate.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { buildNpmProject } from '#cli/generation/projects.ts';
import { STYLESHEET_CASES } from '#tests/config/stylelint.ts';
import { parseToolProject } from '#cli/tools/npm/tool-project.ts';
import testsPackage from '#tests/package.json' with { type: 'json' };
import { YARN_CLIENTS, NEXT_INSTALLATIONS } from '#tests/config/npm.ts';
import { REACT_NATIVE_TSCONFIG, REACT_NATIVE_DEPENDENCIES } from '#tests/config/react.ts';

test.each([...STYLESHEET_CASES])(
    '$name installs postcss-html only when Stylelint reads Vue or Svelte styles',
    async (entry) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': settingsText(entry.configurations),
            ...entry.files,
        });
        const session = await openSession(sandbox.path);
        const manifest = generate(session).files.find(({ path }) => path === '.gspot/package.json')!;
        expect(
            Object.keys(parseToolProject(manifest.content, session.requirePackageManager().name).dependencies).includes(
                'postcss-html',
            ),
        ).toBe(entry.needsHtmlParser);
    },
);

test('a React Native project without Expo installs no Expo or DOM lint plugins', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['typescript', 'react-native']),
        'package.json': JSON.stringify({
            name: 'example',
            private: true,
            dependencies: { ...REACT_NATIVE_DEPENDENCIES, react: testsPackage.devDependencies.react },
        }),
        'tsconfig.json': JSON.stringify(REACT_NATIVE_TSCONFIG),
    });
    const session = await openSession(sandbox.path);
    const generated = generate(session).files.find(({ path }) => path === '.gspot/package.json')!;
    const project = parseToolProject(generated.content, session.requirePackageManager().name);
    expect(project.dependencies).toHaveProperty('eslint-plugin-react-native');
    expect(project.dependencies).not.toHaveProperty('eslint-plugin-expo');
    expect(project.dependencies).not.toHaveProperty('expo-doctor');
    expect(project.dependencies).not.toHaveProperty('eslint-plugin-jsx-a11y');
});

test.each([{ configurations: ['licenses'] }, { configurations: [] }])(
    'a root allowed package installs the license tool for a child scope without a root selection: $configurations',
    async ({ configurations }) => {
        await using sandbox = await testdir({
            'gspot.toml': settingsText([...configurations], {
                tables: '[[licenses.allowed_package]]\nname = "example"\nversion = "1.0.0"\nreason = "Reviewed installed metadata."\n[[scope]]\npath = "docs"\nconfigurations = ["licenses"]\n',
            }),
            'docs/package.json': '{"name":"docs","private":true}',
        });
        const session = await openSession(sandbox.path);
        const generated = generate(session);
        expect(generated.files.find(({ path }) => path === '.gspot/package.json')?.content).toContain(
            'license-checker-rseidelsohn',
        );
        expect(generated.files.find(({ path }) => path === '.gspot/pyproject.toml')).toBeUndefined();
    },
);

test.each([...YARN_CLIENTS])(
    'Yarn $installer.version gets the matching tool project settings',
    ({ installer, settings }) => {
        const files = buildNpmProject({
            root: process.cwd(),
            scopes: [],
            manifests: [],
            installer,
        });
        expect(files.map((file) => file.path)).toStrictEqual(
            settings ? ['.gspot/package.json', '.gspot/.yarnrc.yml'] : ['.gspot/package.json'],
        );
        if (settings) expect(files[1]!.content).toBe('nodeLinker: node-modules\nenableGlobalCache: true\n');
    },
);

test.each([...NEXT_INSTALLATIONS])('$name', async (row) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['nextjs'], {
            tables: `[[scope]]\npath = "app"\nconfigurations = ["nextjs"]\n`,
        }),
        'package.json': '{"private":true,"packageManager":"bun@1.4.2","dependencies":{"next":"*"}}',
        'app/package.json': '{"private":true,"dependencies":{"next":"*"}}',
        ...(row.rootVersion === undefined
            ? {}
            : {
                  'node_modules/next/package.json': JSON.stringify({
                      name: 'next',
                      version: row.rootVersion,
                  }),
              }),
        ...(row.childVersion === undefined
            ? {}
            : {
                  'app/node_modules/next/package.json': JSON.stringify({
                      name: 'next',
                      version: row.childVersion,
                  }),
              }),
    });
    const session = await openSession(sandbox.path);
    if (row.expected === 'conflict') {
        expect(() => generate(session)).toThrow('Tool pin @next/eslint-plugin-next conflicts');
        expect(() => generate(session)).toThrow('the root requires ^16; app requires ^15');
    } else {
        const generated = generate(session).files.find(({ path }) => path === '.gspot/package.json');
        expect(
            parseToolProject(generated!.content, session.requirePackageManager().name).dependencies[
                '@next/eslint-plugin-next'
            ],
        ).toBe(row.expected);
    }
});

test('only selected Next.js scopes set the shared plugin version', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['javascript'], {
            tables: '[[scope]]\npath = "web"\nconfigurations = ["nextjs"]\n[[scope]]\npath = "api"\nconfigurations = ["javascript"]\n',
        }),
        'package.json': '{"private":true,"packageManager":"bun@1.4.2"}',
        'web/package.json': '{"dependencies":{"next":"*"}}',
        'api/package.json': '{"dependencies":{"next":"*"}}',
        'web/node_modules/next/package.json': '{"name":"next","version":"16.3.6"}',
        'api/node_modules/next/package.json': '{"name":"next","version":"15.5.9"}',
    });
    const session = await openSession(sandbox.path);
    const output = generate(session).files.find(({ path }) => path === '.gspot/package.json');
    expect(
        parseToolProject(output!.content, session.requirePackageManager().name).dependencies[
            '@next/eslint-plugin-next'
        ],
    ).toBe('^16');
});
