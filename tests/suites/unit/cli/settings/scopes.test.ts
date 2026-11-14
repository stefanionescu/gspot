import { test, expect } from 'bun:test';
import { getTable } from '#cli/settings/tables.ts';
import { openSession } from '#cli/engine/session.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { selectConfigurationsForScope } from '#cli/settings/scopes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { PROJECT_CHOICES, PROJECT_SCOPE_CASES, OPENAPI_SCOPE_SETTINGS } from '#tests/config/settings/parse.ts';

test('OpenAPI stays off without a document and in a scope that removes it', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['openapi'], OPENAPI_SCOPE_SETTINGS),
        'api/swagger.yaml': 'openapi: 3.1.0\n',
    });

    const session = await openSession(sandbox.path);
    expect(getTable(session.scopes[0]!.settings, 'openapi').document).toBeUndefined();
    expect(session.scopes[1]!.configurations.map(({ name }) => name)).not.toContain('openapi');
});

test.each([...PROJECT_SCOPE_CASES])('scope $scope selects $name: $selected', ({ scope, name, selected }) => {
    const names = selectConfigurationsForScope(
        {
            configurations: [...PROJECT_CHOICES.configurations],
            removed_configurations: [...PROJECT_CHOICES.removed_configurations],
            scopes: new Map(
                PROJECT_CHOICES.scope.map((choice) => [
                    choice.path,
                    {
                        configurations: [...choice.configurations],
                        removed_configurations: [...choice.removed_configurations],
                    },
                ]),
            ),
        },
        scope,
    ).map((configuration) => configuration.name);
    expect(names.includes(name)).toBe(selected);
});
