import { test, expect, describe } from 'bun:test';
import { CHECK_FIELDS } from '#tests/config/harness/tooling.ts';
import { parseConfigurationManifest } from '#tests/harness/tooling.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';

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
        const tables = '[[config]]\ntemplate = "x.yml.tmpl"\ntarget = ".gspot/config/semgrep/x.yml"\n';
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
    const undefinedTools = manifests.flatMap((manifest) =>
        manifest.checks
            .flatMap((check) => (check.command === undefined ? [] : [check.tool ?? check.command[0]!]))
            .filter((name) => !declared.has(name)),
    );
    expect([...new Set(undefinedTools)]).toStrictEqual([]);
});
