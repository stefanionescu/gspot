import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { collectPins } from '#cli/configurations/contracts.ts';
import { toolDeclarationSchema } from '#cli/parsers/schema/public.ts';
import { parseConfigurationManifest } from '#tests/harness/tooling.ts';
import { assertManifests } from '#cli/configurations/errors/contracts.ts';
import { parseManifest, linkManifestTools, configurationManifests } from '#cli/configurations/public.ts';

test.each([
    ['github-actions', 'bash', 'shellcheck'],
    ['nginx', 'docker', 'docker'],
    ['openapi', 'files', 'ajv'],
    ['astro', 'react-dom', 'eslint-plugin-jsx-a11y'],
])('%s receives the complete %s declaration of %s in either selection order', (consumer, owner, name) => {
    const registry = configurationManifests();
    const declared = registry.get(owner)!;
    const reference = registry.get(consumer)!;
    expect(reference.tools.find((tool) => tool.name === name)).toBe(declared.tools.find((tool) => tool.name === name));
    expect(collectPins([reference, declared])).toStrictEqual(collectPins([declared, reference]));
    expect(collectPins([reference]).find((tool) => tool.name === name)).toBe(
        declared.tools.find((tool) => tool.name === name),
    );
});

test.each(['1.0.0', '2.0.0'])('independent tool declarations are refused even with second version %s', (version) => {
    const owner = parseConfigurationManifest('owner', { tables: '[[tool]]\nname = "probe"\nversion = "1.0.0"\n' });
    const second = parseConfigurationManifest('second', {
        tables: `[[tool]]\nname = "probe"\nversion = "${version}"\n`,
    });
    const declarations = new Map([
        ['owner', owner],
        ['second', second],
    ]);
    expect(() => linkManifestTools([...declarations.values()])).toThrow('tool probe is already declared.');
    expect(() => {
        assertManifests(declarations);
    }).toThrow('tool probe is already declared.');
});

test('name-only declarations resolve by registry name and refuse an absent owner', () => {
    expect(toolDeclarationSchema.parse({ name: 'probe' })).toBe('probe');
    const consumer = parseManifest(
        '[configuration]\ntitle = "Consumer"\ndescription = "Consumes a tool declared by another configuration."\n[[tool]]\nname = "probe"\n',
        'configurations/infra/consumer',
    );
    expect(() => linkManifestTools([consumer])).toThrow('tool probe has no declaration.');
    const owner = parseConfigurationManifest('owner', { tables: '[[tool]]\nname = "probe"\nsystem = true\n' });
    const declarations = new Map([
        ['consumer', consumer],
        ['owner', owner],
    ]);
    for (const entries of [declarations, new Map([...declarations].toReversed())]) {
        const linked = linkManifestTools([...entries.values()]);
        expect(linked.get('consumer')?.tools[0]).toBe(owner.tools[0]);
        expect(() => {
            assertManifests(linked);
        }).not.toThrow();
    }
});

test('native tool fields and installer constraints keep their validation', () => {
    expect(toolDeclarationSchema.safeParse('probe').success).toBe(false);
    expect(toolDeclarationSchema.safeParse({ name: 'probe', mystery: true }).success).toBe(false);
    expect(
        toolDeclarationSchema.safeParse({
            name: 'probe',
            version: '1.0.0',
            pypi: { name: 'probe', version: '1.0.0', constraints: ['not a constraint'] },
        }).success,
    ).toBe(false);
    const tool = toolDeclarationSchema.parse({ name: 'probe', version: '1.0.0', npm: 'native-probe' });
    expect(tool).toMatchObject({
        name: 'probe',
        kind: 'binary',
        installers: { npm: { name: 'native-probe', version: '1.0.0' } },
    });
});

test.each(['recommended', 'all'] as const)(
    'manual Actions selection keeps ShellCheck metadata at %s in root and child scopes',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['github-actions'], {
                level,
                tables: '[scope.app]\nconfigurations = ["github-actions"]\n',
            }),
            '.github/workflows/check.yml': 'name: Check\non: push\njobs: {}\n',
            'app/.github/workflows/check.yml': 'name: Check\non: push\njobs: {}\n',
        });
        const session = await openSession(sandbox.path);
        const declared = configurationManifests()
            .get('bash')
            ?.tools.find((tool) => tool.name === 'shellcheck');
        expect(declared?.suppression).toBeDefined();
        expect(declared?.refused_options).toBeDefined();
        for (const scope of session.scopes) {
            expect(scope.selected.some((manifest) => manifest.configuration.name === 'bash')).toBe(false);
            expect(collectPins(scope.selected).find((tool) => tool.name === 'shellcheck')).toBe(declared);
        }
        expect(session.scopes.map((scope) => scope.scope.path)).toStrictEqual(['', 'app']);
    },
);
