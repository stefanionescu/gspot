import { test, expect } from 'bun:test';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { parseConfigurations } from '#cli/manifests/read.ts';
import { buildConfiguration } from '#tests/setup/cli/manifests.ts';

import {
    DECLARATION_ORDERS,
    CONFIGURATION_TABLE,
    EXAMPLE_MANIFEST_FOLDER,
    MANIFEST_INVARIANT_CASES,
} from '#tests/config/manifests.ts';

test('a manifest without [detect] takes the matchers of [files]', () => {
    const tables = '[files]\nfilenames = ["native.project"]\npaths = ["source/**"]\n';
    const inherited = buildConfiguration('native', { tables });
    expect(inherited.detect.filenames).toStrictEqual(['native.project']);
    expect(inherited.detect.paths).toStrictEqual(['source/**']);
    const explicit = buildConfiguration('native', {
        tables: '[detect]\nfilenames = ["explicit.project"]\n' + tables,
    });
    expect(explicit.detect.filenames).toStrictEqual(['explicit.project']);
    expect(explicit.detect.paths).toStrictEqual([]);
    const empty = buildConfiguration('native', { tables: '[detect]\n' + tables });
    expect(empty.detect.filenames).toStrictEqual([]);
    expect(empty.detect.paths).toStrictEqual([]);
});

test.each(DECLARATION_ORDERS)(
    'a tool name links to the configuration that declares it, listed $order',
    ({ ownerFirst }) => {
        const consumer = {
            folder: 'src/configurations/infrastructure/consumer',
            text: CONFIGURATION_TABLE + '[[tool]]\nname = "probe"\n',
        };
        const owner = {
            folder: 'src/configurations/general/owner',
            text: CONFIGURATION_TABLE + '[[tool]]\nname = "probe"\nsystem = true\n',
        };
        const configurationsByName = parseConfigurations(ownerFirst ? [owner, consumer] : [consumer, owner]);
        expect(configurationsByName.get('owner')!.tools).toStrictEqual([
            { name: 'probe', kind: 'program', system: true, installers: {} },
        ]);
        expect(configurationsByName.get('consumer')!.tools).toStrictEqual(configurationsByName.get('owner')!.tools);
    },
);

test('only declared config files are loaded and each record sets its tool and scope', () => {
    const configurationsByName = parseConfigurations([
        {
            folder: EXAMPLE_MANIFEST_FOLDER,
            text:
                CONFIGURATION_TABLE +
                '\n[[config_file]]\ntarget = "other.yml"\npointer = { path = "other.yml", body = "{target}" }\n\n[[config_file]]\ntarget = "semgrep/first.yml"\ntool = "semgrep"\nper_scope = true\n\n[[config_file]]\ntarget = "semgrep/second.yml"\ntool = "semgrep"\nper_scope = true\n' +
                '[[tool]]\nname = "semgrep"\nversion = "1.0.0"\n',
        },
    ]);
    const configuration = configurationsByName.get('example')!;
    expect(configuration.configs.map(({ source, target }) => [source, target])).toStrictEqual([
        ['files/other.yml', `${GSPOT_PATHS.configurations}/language/example/other.yml`],
        ['files/semgrep/first.yml', `${GSPOT_PATHS.configurations}/language/example/semgrep/first.yml`],
        ['files/semgrep/second.yml', `${GSPOT_PATHS.configurations}/language/example/semgrep/second.yml`],
    ]);
    expect(configuration.configs.slice(1, 3)).toMatchObject([
        { tool: ['semgrep'], per_scope: true },
        { tool: ['semgrep'], per_scope: true },
    ]);
});

test.each([...MANIFEST_INVARIANT_CASES])(
    'the loader refuses $name with the owning configuration',
    ({ tables, message }) => {
        const manifests = [{ folder: EXAMPLE_MANIFEST_FOLDER, text: CONFIGURATION_TABLE + tables }];
        expect(() => parseConfigurations(manifests)).toThrow(
            `The configuration manifest for example is not valid:\n${message}`,
        );
    },
);

test('a reference to an undeclared tool names the configuration and missing declaration', () => {
    const manifests = [{ folder: EXAMPLE_MANIFEST_FOLDER, text: CONFIGURATION_TABLE + '[[tool]]\nname = "absent"\n' }];
    expect(() => parseConfigurations(manifests)).toThrow(
        'The configuration manifest for example is not valid:\ntool absent has no declaration.',
    );
});
