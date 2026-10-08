import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { npmProject } from '#cli/generation/npm.ts';
import { emitAll } from '#cli/generation/outputs.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { YARN_MANAGERS } from '#tests/config/samples/npm.ts';
import { NPM_TOOL_PROJECT } from '#cli/config/parsers/packages.ts';
import { toolProjectSchema } from '#cli/parsers/schema/packages.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { parseToolProject, getPackageInstallerMajor } from '#cli/parsers/packages.ts';
import { TOOL_REQUIREMENTS, NEXT_INSTALLATIONS } from '#tests/config/cli/generation/npm.ts';

test.each(YARN_MANAGERS)(
    'Yarn $installer.version selects compatible generated settings and native lockfile creation',
    ({ installer, settings }) => {
        const files = npmProject({
            root: process.cwd(),
            scopes: [],
            manifests: [],
            installer,
            runner: 'mise',
        });
        expect(files.map((file) => file.path)).toStrictEqual(
            settings ? ['.gspot/package.json', '.gspot/.yarnrc.yml'] : ['.gspot/package.json'],
        );
        expect(parseToolProject(files[0]!.content).installer).toStrictEqual({
            name: installer.name,
            version: `${String(getPackageInstallerMajor(installer))}.x`,
        });
        if (settings) expect(files[1]!.content).toBe('nodeLinker: node-modules\nenableGlobalCache: true\n');
    },
);

test.each(NEXT_INSTALLATIONS)('$name', async (row) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['nextjs'], {
            tables: `[agent_rules]\nenabled = false\n[scope.app]\nconfigurations = ["nextjs"]\n`,
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
    const marker = join(sandbox.path, 'authored.txt');
    await writeFile(marker, 'Keep the source file.');
    const session = await openSession(sandbox.path);
    if (row.expected === 'conflict') {
        expect(() => emitAll(session)).toThrow('Tool pin @next/eslint-plugin-next conflicts');
        expect(() => emitAll(session)).toThrow('the root requires ^16; app requires ^15');
    } else {
        const generated = emitAll(session).files.find(({ path }) => path === '.gspot/package.json');
        const expected =
            row.expected === 'manifest'
                ? configurationManifests()
                      .get('nextjs')!
                      .tools.find(({ name }) => name === '@next/eslint-plugin-next')!.version
                : row.expected;
        expect(parseToolProject(generated!.content).dependencies['@next/eslint-plugin-next']).toBe(expected);
    }
    expect(await readFile(marker, 'utf8')).toBe('Keep the source file.');
});

test('only selected Next scopes constrain the shared plugin version', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['javascript'], {
            tables: '[scope.web]\nconfigurations = ["nextjs"]\n[scope.api]\nconfigurations = ["javascript"]\n',
        }),
        'package.json': '{"private":true,"packageManager":"bun@1.4.2"}',
        'web/package.json': '{"dependencies":{"next":"*"}}',
        'api/package.json': '{"dependencies":{"next":"*"}}',
        'web/node_modules/next/package.json': '{"name":"next","version":"16.3.6"}',
        'api/node_modules/next/package.json': '{"name":"next","version":"15.5.9"}',
    });
    const output = emitAll(await openSession(sandbox.path)).files.find(({ path }) => path === '.gspot/package.json');
    expect(parseToolProject(output!.content).dependencies['@next/eslint-plugin-next']).toBe('^16');
});

test.each(TOOL_REQUIREMENTS)('$name', ({ dependency, version, accepted }) => {
    const result = toolProjectSchema.safeParse({
        ...NPM_TOOL_PROJECT,
        packageManager: 'bun@1.x',
        devDependencies: { [dependency]: version },
    });
    expect(result.success).toBe(accepted);
    if (!result.success) expect(result.error.issues[0]?.path).toEqual(['devDependencies', dependency]);
});
