import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/engine/session.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { buildIgnoreSections } from '#cli/generation/ignores.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { CONFIG_PROJECT } from '#tests/config/setup/configurations.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { buildConfigs, buildConfigFile } from '#cli/generation/configs.ts';

test('a check copy builds the config files of the repository, not of the copy folder', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['typescript'], {
            scopes: [{ path: 'docs', configurations: ['typescript'] }],
        }),
        'docs/tsconfig.json': '{"extends":"preset/tsconfig.json","include":["src"]}',
        'docs/node_modules/preset/tsconfig.json': '{"compilerOptions":{"strict":true}}',
        'docs/node_modules/preset/package.json': '{"name":"preset","version":"1.0.0"}',
        'docs/src/index.ts': 'export const value = 1;\n',
    });
    await using copy = await testdir({ 'docs/src/index.ts': 'export const value = 1;\n' });

    const copied = buildConfigs({ ...(await openSession(sandbox.path)), root: copy.path });
    expect(copied).toStrictEqual(buildConfigs(await openSession(sandbox.path)));
});

test('every shipped source config has a working producer, including optional outputs', async () => {
    const configurations = [...readConfigurations().values()];
    await using sandbox = await createGitSandbox({
        ...CONFIG_PROJECT,
        'gspot.toml': buildSandboxSettings(
            configurations.map(({ name }) => name),
            { level: 'all', rules: true },
        ),
    });
    const session = await openSession(sandbox.path);
    const scope = session.scopes[0]!;
    const targets = new Map([
        ['', new Map(configurations.flatMap(({ configs }) => configs.map(({ target }) => [target, target] as const)))],
    ]);
    const ownedConfigs = configurations.flatMap((configuration) =>
        configuration.configs.map((config) => ({ config, owner: { session, scope, configuration } })),
    );
    for (const { config, owner } of ownedConfigs) {
        const { source } = config;
        if (source === undefined) continue;
        expect(() =>
            buildConfigFile({ config: { ...config, source }, owner }, config.target, {
                targets,
                ignoreSections: buildIgnoreSections(session, { targets: new Map() }),
            }),
        ).not.toThrow();
    }
});
