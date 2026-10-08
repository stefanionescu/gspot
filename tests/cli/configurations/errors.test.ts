import { test, expect, describe } from 'bun:test';
import { CHECK_FIELDS } from '#tests/config/harness/tooling.ts';
import { assertManifests } from '#cli/configurations/errors.ts';
import { parseConfigurationManifest } from '#tests/harness/tooling.ts';

import {
    SHARED_SETTING,
    WAITING_SETTING,
    CONSUMER_DECLARATION,
    SELECTOR_DECLARATION,
    MINIMUM_VERSION_CASES,
    INVALID_VERSION_FLOORS,
    ROOT_SELECTOR_REFUSALS,
    SYSTEM_TOOL_DECLARATION,
    ROOT_SELECTOR_DECLARATION,
} from '#tests/config/cli/configurations/errors.ts';

describe('assertManifests setting meanings', () => {
    test('two configurations must agree on a setting meaning and may differ only in its default', () => {
        const owner = parseConfigurationManifest('owner', { tables: SHARED_SETTING });
        const consumer = parseConfigurationManifest('consumer', { tables: SHARED_SETTING });
        const setting = owner.settings[0]!;
        consumer.settings[0] = { ...setting, type: 'boolean' };
        const manifests = new Map([
            ['owner', owner],
            ['consumer', consumer],
        ]);
        expect(() => {
            assertManifests(manifests);
        }).toThrow('setting example.target differs from its declaration in owner.');
        consumer.settings[0] = { ...setting, default: 'other' };
        expect(() => {
            assertManifests(manifests);
        }).not.toThrow();
    });
});

describe('assertManifests check replacements', () => {
    test('an invalid replacement is refused and a different declared check is accepted', () => {
        const project = parseConfigurationManifest('project');
        const owner = parseConfigurationManifest('owner', {
            tables: `[[check]]\nname = "parse"\ncommand = ["tool"]\n${CHECK_FIELDS}`,
        });
        project.checks = [{ ...owner.checks[0]!, name: 'project/description', replaces: 'project/missing' }];
        const manifests = new Map([
            ['project', project],
            ['owner', owner],
        ]);
        expect(() => {
            assertManifests(manifests);
        }).toThrow('project/missing');
        project.checks[0]!.replaces = 'project/description';
        expect(() => {
            assertManifests(manifests);
        }).toThrow('different check');
        project.checks[0]!.replaces = 'owner/parse';
        expect(() => {
            assertManifests(manifests);
        }).not.toThrow();
    });

    test('circular replacement is refused before either check can suppress execution', () => {
        const project = parseConfigurationManifest('project', {
            tables: `[[check]]\nname = "first"\ncommand = ["tool"]\n${CHECK_FIELDS}`,
        });
        const original = project.checks[0]!;
        project.checks = [
            { ...original, name: 'project/first', replaces: 'project/second' },
            { ...original, name: 'project/second', replaces: 'project/first' },
        ];
        expect(() => {
            assertManifests(new Map([['project', project]]));
        }).toThrow('project/first -> project/second -> project/first');
    });
});

describe('assertManifests borrowed checks', () => {
    test('check references require another standalone built-in owner and preserve its definition', () => {
        const owner = parseConfigurationManifest('owner', {
            tables: `[[check]]\nname = "shared"\nruns = "once"\n${CHECK_FIELDS}`,
        });
        const consumer = parseConfigurationManifest('consumer');
        const check = owner.checks[0]!;
        consumer.configuration.borrowed_checks = ['owner/shared'];
        const manifests = new Map([
            ['owner', owner],
            ['consumer', consumer],
        ]);
        expect(() => {
            assertManifests(manifests);
        }).not.toThrow();
        consumer.configuration.borrowed_checks = ['missing/shared'];
        expect(() => {
            assertManifests(manifests);
        }).toThrow('Referenced check missing/shared');
        consumer.configuration.borrowed_checks = ['owner/shared'];
        owner.checks[0] = { ...check, runs: 'scope' };
        expect(() => {
            assertManifests(manifests);
        }).toThrow('standalone built-in');
        owner.checks[0] = { ...check, tool: 'scanner' };
        expect(() => {
            assertManifests(manifests);
        }).toThrow('standalone built-in');
    });
});

describe('assertManifests native version prerequisites', () => {
    test('a native floor requires a declared tool even when its command names that tool', () => {
        const manifest = parseConfigurationManifest('minimum', {
            tables: `[[check]]\nname = "run"\ncommand = ["probe"]\nmin_versions = {probe = "4.4"}\n${CHECK_FIELDS}`,
        });
        expect(() => {
            assertManifests(new Map([['minimum', manifest]]));
        }).toThrow('version floor for undeclared tool probe');
    });
    test.each(MINIMUM_VERSION_CASES)(
        'native version floors validate their consumer and version command: $target $diagnostic',
        ({ target, versionCommand, diagnostic }) => {
            const manifest = parseConfigurationManifest('minimum', {
                tables: `[[tool]]\nname = "probe"\nsystem = true\n${versionCommand}[[check]]\nname = "run"\ncommand = ["probe"]\nmin_versions = {${target} = "4.4"}\n${CHECK_FIELDS}`,
            });
            const validate = () => {
                assertManifests(new Map([['minimum', manifest]]));
            };
            if (diagnostic === undefined) {
                expect(validate).not.toThrow();
                expect(manifest.checks[0]?.min_versions).toStrictEqual({ probe: '4.4.0' });
            } else expect(validate).toThrow(diagnostic);
        },
    );

    test.each(INVALID_VERSION_FLOORS)(
        'a malformed native version floor %s is refused at the manifest boundary',
        (floor) => {
            expect(() =>
                parseConfigurationManifest('minimum', {
                    tables: `[[check]]\nname = "run"\ncommand = ["probe"]\nmin_versions = {probe = "${floor}"}\n${CHECK_FIELDS}`,
                }),
            ).toThrow('min_versions');
        },
    );
});

describe('assertManifests installation and guide declarations', () => {
    test.each([
        ['[[tool]]\nname = "unpinned"\nnpm = "unpinned"\n', 'has no version and no floor'],
        ['[[tool]]\nname = "low"\nversion = "1.0.0"\nmin_version = "2.0.0"\nnpm = "low"\n', 'below its floor 2.0.0'],
    ])('a manifest whose tool is not pinned is refused: %s', (tables, diagnostic) => {
        const manifest = parseConfigurationManifest('pinned', { kind: 'tool', tables });
        expect(() => {
            assertManifests(new Map([['pinned', manifest]]));
        }).toThrow(diagnostic);
    });

    test.each([
        { name: 'an absent wait', wait: '', message: 'must wait for it' },
        {
            name: 'an undeclared wait',
            wait: 'when = {setting = "tools.waiting.other"}\n',
            message: 'which no configuration declares',
        },
        { name: 'the declared wait', wait: 'when = {setting = "tools.waiting.target"}\n', message: undefined },
    ])('a check reading an empty setting validates $name', ({ wait, message: diagnostic }) => {
        const manifest = parseConfigurationManifest('waiting', {
            kind: 'tool',
            tables: `${WAITING_SETTING}[[check]]\nname = "run"\ncommand = ["tool", "{setting:tools.waiting.target}"]\n${wait}${CHECK_FIELDS}`,
        });
        const manifests = new Map([['waiting', manifest]]);
        if (diagnostic === undefined)
            expect(() => {
                assertManifests(manifests);
            }).not.toThrow();
        else
            expect(() => {
                assertManifests(manifests);
            }).toThrow(diagnostic);
    });

    test('a conditional agent guide must exist in its configuration before selection', () => {
        const manifest = parseConfigurationManifest('example', {
            kind: 'general',
            tables: '[agent_rules]\n"MISSING.md" = {dependencies = ["example"]}\n',
        });
        expect(() => {
            assertManifests(new Map([['example', manifest]]));
        }).toThrow('Rule MISSING.md does not exist in this configuration.');
    });
});

test('a generated config refuses an undeclared consuming tool and accepts a tool declared by another configuration', () => {
    const consumer = parseConfigurationManifest('consumer', { kind: 'tool', tables: CONSUMER_DECLARATION });
    const executable = parseConfigurationManifest('executable', { kind: 'tool', tables: SYSTEM_TOOL_DECLARATION });
    const manifests = new Map([['consumer', consumer]]);
    expect(() => {
        assertManifests(manifests);
    }).toThrow('config .gspot/config/example.toml requires undeclared tool example.');
    manifests.set('executable', executable);
    expect(() => {
        assertManifests(manifests);
    }).not.toThrow();
    consumer.toolFiles[0]!.required_tools = ['missing-parser'];
    expect(() => {
        assertManifests(manifests);
    }).toThrow('requires undeclared tool missing-parser.');
    consumer.toolFiles[0]!.required_tools = ['example'];
    expect(() => {
        assertManifests(manifests);
    }).not.toThrow();
    expect(consumer.toolFiles[0]?.tool).toStrictEqual(['example']);
    expect(
        parseConfigurationManifest('consumer', {
            kind: 'tool',
            tables: CONSUMER_DECLARATION.replace('["example"]', '"example"'),
        }).toolFiles[0]?.tool,
    ).toStrictEqual(['example']);
    consumer.toolFiles[0]!.check = ['executable/missing'];
    expect(() => {
        assertManifests(manifests);
    }).toThrow('config .gspot/config/example.toml requires undeclared check executable/missing.');
});

test.each([
    {
        name: 'a key without shared ownership',
        selection: 'key = "eslintConfig"',
        message: 'A selected key or table must preserve its shared file.',
    },
    {
        name: 'a table without shared ownership',
        selection: 'table = "tool.ruff"',
        message: 'A selected key or table must preserve its shared file.',
    },
    {
        name: 'both a key and a table',
        selection: 'key = "eslintConfig"\ntable = "tool.ruff"\nshared = true',
        message: 'A replace row selects either a key or a table.',
    },
])('replacement refuses $name', ({ selection, message: diagnostic }) => {
    expect(() =>
        parseConfigurationManifest('example', {
            tables: SELECTOR_DECLARATION + selection,
        }),
    ).toThrow(diagnostic);
});

test('a replacement selecting a shared key preserves the containing file', () => {
    expect(() =>
        parseConfigurationManifest('example', {
            tables: `${SELECTOR_DECLARATION}key = "eslintConfig"\nshared = true\n`,
        }),
    ).not.toThrow();
});

test('native root selectors retain fragment-only component and import refusals', () => {
    expect(() => parseConfigurationManifest('owner', { tables: ROOT_SELECTOR_DECLARATION })).not.toThrow();
    for (const [field, diagnostic] of ROOT_SELECTOR_REFUSALS) {
        const tables = ROOT_SELECTOR_DECLARATION.replace(
            '[[tool_file.selectors]]',
            `${field}\n[[tool_file.selectors]]`,
        );
        expect(() => parseConfigurationManifest('owner', { tables })).toThrow(diagnostic);
    }
});
