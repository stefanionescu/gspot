import { test, expect, describe } from 'bun:test';
import { toolName } from '#cli/configurations/contracts.ts';
import { CHECK_FIELDS } from '#tests/config/samples/checks.ts';
import { configurationManifests } from '#cli/configurations/public.ts';
import { parseConfigurationManifest } from '#tests/harness/tooling.ts';
import { assertManifests } from '#cli/configurations/errors/contracts.ts';

describe('parseManifest check declarations', () => {
    test.each(['runs = "once"\ncommand = ["x", "{files}"]', 'command = ["x"]'])(
        'file isolation refuses the incomplete command %s',
        (command) => {
            expect(() =>
                parseConfigurationManifest('example', {
                    tables: `[[check]]\nname = "parse"\nrun_in_copy = true\n${CHECK_FIELDS}${command}\n`,
                }),
            ).toThrow('check example/parse isolates files');
        },
    );

    test.each(['command = ["x", "{files}"]', 'runs = "scope"\ncommand = ["x", "{root}"]'])(
        'file isolation accepts the complete command %s',
        (command) => {
            expect(() =>
                parseConfigurationManifest('example', {
                    tables: `[[check]]\nname = "parse"\nrun_in_copy = true\n${CHECK_FIELDS}${command}\n`,
                }),
            ).not.toThrow();
        },
    );

    test.each([{ name: 'an empty command', execution: 'command = []', message: 'check.0.command' }])(
        'manifest loading rejects $name at its declared field',
        ({ execution, message: diagnostic }) => {
            expect(() =>
                parseConfigurationManifest('example', {
                    tables: `[[check]]\nname = "parse"\n${CHECK_FIELDS}${execution}\n`,
                }),
            ).toThrow(diagnostic);
        },
    );

    test('a generated configuration needs a reader in its manifest or the configuration it requires', () => {
        const tables = '[[tool_file]]\nsource = "x.yml.eta"\ntarget = ".gspot/config/semgrep/x.yml"\n';
        expect(() => parseConfigurationManifest('example', { tables })).toThrow('has no check that reads it');
        expect(() =>
            parseConfigurationManifest('example', {
                tables: `${tables}when = {configuration = "security"}\n`,
            }),
        ).not.toThrow();
    });
});

test('every tool named by a manifest command is declared by a shipped configuration', () => {
    const manifests = [...configurationManifests().values()];
    const declared = new Set(manifests.flatMap((manifest) => manifest.tools.map((tool) => tool.name)));
    const undefinedTools = manifests.flatMap((manifest) => {
        const settings = new Map(manifest.settings.map((setting) => [setting.name, setting]));
        return manifest.checks
            .flatMap((check) => {
                if (typeof check.tool === 'object') return Object.values(check.tool);
                if (check.command === undefined) return [];
                const command = toolName(check)!;
                if (!command.startsWith('{setting:')) return [command];
                const name = command.slice('{setting:'.length, -1);
                const declaration = settings.get(name);
                expect(declaration).toMatchObject({ type: 'list', items: 'string' });
                expect(check.when).toMatchObject({ setting: name });
                return [];
            })
            .filter((name) => !declared.has(name));
    });
    expect([...new Set(undefinedTools)]).toStrictEqual([]);
});

test.each([
    'requires = [1]',
    'requires = [""]',
    'when = { setting = 1 }',
    'when = { setting = "architecture.modules", level = "preview" }',
    'when = []',
])('native tool metadata refuses %s', (metadata) => {
    expect(() =>
        parseConfigurationManifest('example', {
            tables: `[[tool]]\nname = "native"\nversion = "1.0.0"\nnpm = "native"\n${metadata}\n`,
        }),
    ).toThrow();
});

test.each(['tool = { "package.json" = 1 }', 'tool = { "package.json" = "" }'])(
    'native file-to-tool metadata refuses %s',
    (metadata) => {
        expect(() =>
            parseConfigurationManifest('example', {
                tables: `[[check]]\nname = "parse"\n${CHECK_FIELDS}${metadata}\n`,
            }),
        ).toThrow();
    },
);

test.each([
    'requires = ["missing-peer"]',
    `\n[[check]]\nname = "parse"\n${CHECK_FIELDS}command = ["native"]\ntool = { "package.json" = "missing-peer" }`,
])('native declaration references refuse an undeclared peer: %s', (metadata) => {
    const manifest = parseConfigurationManifest('example', {
        tables: `[[tool]]\nname = "native"\nversion = "1.0.0"\nnpm = "native"\n${metadata}\n`,
    });
    expect(() => {
        assertManifests(new Map([['example', manifest]]));
    }).toThrow('requires undeclared tool missing-peer');
});
