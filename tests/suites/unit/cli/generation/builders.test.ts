import { test, expect } from 'bun:test';
import { openSession } from '#cli/planning/session.ts';
import { buildConfig } from '#cli/generation/builders.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { buildIgnoreSections } from '#cli/generation/ignores.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { CONFIG_PROJECT } from '#tests/config/generation/configs.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

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
            buildConfig({ config: { ...config, source }, owner }, config.target, {
                targets,
                ignoreSections: buildIgnoreSections(session),
            }),
        ).not.toThrow();
    }
});
