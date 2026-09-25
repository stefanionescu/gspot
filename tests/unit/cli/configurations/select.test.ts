import type { Manifest } from '#cli/configurations/manifests.ts';
import { configurationManifests, parseManifest, validateManifests } from '#cli/configurations/manifests.ts';
import { selectConfigurations } from '#cli/configurations/select.ts';
import { describe, expect, test } from 'bun:test';

function manifest(configurationName: string, requires: string[] = []): Manifest {
    return parseManifest(
        `[configuration]\nname = "${configurationName}"\nkind = "language"\ntitle = "${configurationName}"\nrequires = ${JSON.stringify(requires)}\ndescription = "A configuration for the tests, long enough."\n`,
        `configurations/${configurationName}`,
    );
}

test.each(['copy = true', 'body = "include target"', 'merge = { extends = "target" }'])(
    'a template stub rejects the conflicting emission mode %s',
    (mode) => {
        const source = `[configuration]\nname = "example"\nkind = "policy"\ntitle = "Example"\ndescription = "A configuration for the tests, long enough."\n[[configs]]\ntemplate = "config.tmpl"\ntarget = ".gspot/config.toml"\n[configs.stub]\npath = "config.toml"\ntemplate = "editor.tmpl"\n`;
        expect(() => parseManifest(`${source}${mode}\n`, 'configurations/example')).toThrow(
            'A template stub cannot also specify body, merge, or copy.',
        );
        expect(() => parseManifest(source, 'configurations/example')).not.toThrow();
    },
);

describe('selectConfigurations', () => {
    test('pulls required configurations in, dependencies first, in order of first mention', () => {
        const manifests = new Map([
            ['app', manifest('app', ['client', 'server'])],
            ['client', manifest('client', ['base'])],
            ['server', manifest('server', ['base'])],
            ['base', manifest('base')],
        ]);
        const ids = selectConfigurations(['app', 'client'], manifests).map((entry) => entry.configuration.name);
        expect(ids).toStrictEqual(['base', 'client', 'server', 'app']);
    });

    test('a recommended configuration is not pulled in by selection; init adds it and a person can drop it', () => {
        const manifests = configurationManifests();
        const ids = selectConfigurations(['bash'], manifests).map((entry) => entry.configuration.name);
        expect(ids).not.toContain('naming');
    });

    test('an unknown configuration names the near matches', () => {
        expect(() => selectConfigurations(['bassh'], configurationManifests())).toThrow('Did you mean `bash`');
    });

    test('a circular requires fails with the chain', () => {
        const map = new Map([
            ['a', manifest('a', ['b'])],
            ['b', manifest('b', ['a'])],
        ]);
        expect(() => selectConfigurations(['a'], map)).toThrow('a -> b -> a');
    });
});

describe('parseManifest', () => {
    test.each(['runs = "once"\ncommand = ["x", "{files}"]', 'command = ["x"]'])(
        'file isolation refuses an incomplete command declaration %s',
        (command) => {
            const source =
                '[configuration]\nname = "x"\nkind = "tool"\ntitle = "x"\ndescription = "A configuration for the tests, long enough."\n[[checks]]\nexample = "A rejected input is corrected before rerunning the parser."\nname = "x/y"\nlevel = "recommended"\nstage = "commit"\nisolated_files = true\nsummary = "A sentence long enough."\nwhy = "A sentence long enough."\nhelp = "A sentence long enough."\n';
            expect(() => parseManifest(`${source}${command}\n`, 'configurations/x')).toThrow('isolates files');
            expect(() => parseManifest(`${source}command = ["x", "{files}"]\n`, 'configurations/x')).not.toThrow();
            expect(() =>
                parseManifest(`${source}runs = "per-scope"\ncommand = ["x", "{root}"]\n`, 'configurations/x'),
            ).not.toThrow();
        },
    );

    test('remaining-finding exit codes require a correction command', () => {
        const source =
            '[configuration]\nname = "x"\nkind = "tool"\ntitle = "x"\ndescription = "A configuration for the tests, long enough."\n[[checks]]\nexample = "A rejected input is corrected before rerunning the parser."\nlevel = "recommended"\nname = "x/y"\nstage = "commit"\ncommand = ["x"]\nfix_findings_exit_codes = [1]\nsummary = "A sentence long enough."\nwhy = "A sentence long enough."\nhelp = "A sentence long enough."\n';
        expect(() => parseManifest(source, 'configurations/x')).toThrow('fix_findings_exit_codes and no fix_command');
        expect(() =>
            parseManifest(`${source}fix_command = ["x", "--fix"]\nfix_order = "codemod"\n`, 'configurations/x'),
        ).not.toThrow();
    });

    test('refuses a check without an enforcement level', () => {
        const text =
            '[configuration]\nname = "x"\nkind = "tool"\ntitle = "x"\ndescription = "A configuration for checking input."\n[[checks]]\nexample = "A rejected input is corrected before rerunning the parser."\nname = "x/parse"\nstage = "commit"\ncommand = ["x"]\nsummary = "Parses the project input."\nwhy = "Invalid input cannot run."\nhelp = "Correct the invalid input."\n';
        expect(() => parseManifest(text, 'configurations/x')).toThrow('level');
    });

    test('refuses a check with no stage or an empty summary', () => {
        expect(() =>
            parseManifest(
                '[configuration]\nname = "x"\nkind = "tool"\ntitle = "x"\ndescription = "A configuration for the tests, long enough."\n[[checks]]\nexample = "A rejected input is corrected before rerunning the parser."\nlevel = "recommended"\nname = "x/y"\ncommand = ["x"]\nsummary = ""\nwhy = "A sentence long enough."\nhelp = "A sentence long enough."\n',
                'configurations/x',
            ),
        ).toThrow('not valid');
    });

    test('refuses a fix_command without a fix_order', () => {
        expect(() =>
            parseManifest(
                '[configuration]\nname = "x"\nkind = "tool"\ntitle = "x"\ndescription = "A configuration for the tests, long enough."\n[[checks]]\nexample = "A rejected input is corrected before rerunning the parser."\nlevel = "recommended"\nname = "x/y"\nstage = "commit"\ncommand = ["x"]\nfix_command = ["x", "--fix"]\nsummary = "A sentence long enough."\nwhy = "A sentence long enough."\nhelp = "A sentence long enough."\n',
                'configurations/x',
            ),
        ).toThrow('fix_order');
    });

    test('a manifest rejects an unknown engine before planning checks', () => {
        const text =
            '[configuration]\nname = "x"\nkind = "tool"\ntitle = "x"\ndescription = "A configuration for the tests, long enough."\n[[checks]]\nexample = "A rejected input is corrected before rerunning the parser."\nlevel = "recommended"\nname = "x/y"\nstage = "commit"\nengine = "nope"\nsummary = "A sentence long enough."\nwhy = "A sentence long enough."\nhelp = "A sentence long enough."\n';
        expect(() => parseManifest(text, 'configurations/x')).toThrow('engine');
    });
});

test.each([
    'command = []',
    'command = ["x"]\nengine = "integrity"',
    'command = ["x"]\nanalysis = "typescript"',
    'analysis = "typescript"',
    'tool = "tsc"\nanalysis = "unknown-analysis"',
    'reported_by = "x/owner"\ncommand = ["x"]',
    'reported_by = "x/owner"\nengine = "integrity"',
    'reported_by = "x/owner"\nfix_command = ["x"]\nfix_order = "format"',
])('manifest loading rejects an invalid execution form: %s', (execution) => {
    const text = `[configuration]
name = "x"
kind = "tool"
title = "Project input"
description = "Checks project input before execution."
[[checks]]
example = "A rejected input is corrected before rerunning the parser."
name = "x/parse"
level = "recommended"
stage = "commit"
${execution}
summary = "Parses project input before execution."
why = "Invalid project input cannot run."
help = "Correct the reported project input."
`;
    expect(() => parseManifest(text, 'configurations/x')).toThrow('not valid');
});

test('loading two configurations refuses duplicate executable check ownership', () => {
    const definition =
        '\n[[checks]]\nexample = "A rejected input is corrected before rerunning the parser."\nname = "project/parse"\nlevel = "recommended"\nstage = "commit"\ncommand = ["tool"]\nsummary = "Parses the project input."\nwhy = "Invalid input cannot run."\nhelp = "Correct the reported input."\n';
    const manifests = new Map(
        ['first', 'second'].map((name) => [
            name,
            parseManifest(
                `[configuration]\nname = "${name}"\nkind = "tool"\ntitle = "Input"\ndescription = "Checks the project input."\n${definition}`,
                `configurations/${name}`,
            ),
        ]),
    );
    expect(() => {
        validateManifests(manifests);
    }).toThrow('check project/parse is already owned by first');
});

test.each(['reported_by', 'takes_over'] as const)(
    'manifest collection rejects invalid %s ownership and accepts a runnable owner',
    (field) => {
        const project = manifest('project');
        const checks = `
[[checks]]
example = "A rejected input is corrected before rerunning the parser."
name = "project/parse"
level = "recommended"
stage = "commit"
command = ["tool"]
summary = "Parses the project input."
why = "Invalid input cannot run."
help = "Correct the reported input."
`;
        const owner = parseManifest(
            '[configuration]\nname = "owner"\nkind = "tool"\ntitle = "Owner"\ndescription = "Executes project validation."\n' +
                checks,
            'configurations/owner',
        );
        const executable = owner.checks[0]!;
        project.checks = [{ ...executable, name: 'project/description', [field]: 'project/missing' }];
        const manifests = new Map([
            ['project', project],
            ['owner', owner],
        ]);
        expect(() => {
            validateManifests(manifests);
        }).toThrow('project/missing');
        project.checks[0]![field] = 'project/description';
        expect(() => {
            validateManifests(manifests);
        }).toThrow('different executable check');
        project.checks[0]![field] = 'project/parse';
        expect(() => {
            validateManifests(manifests);
        }).not.toThrow();
        owner.checks[0]!.reported_by = 'project/description';
        expect(() => {
            validateManifests(manifests);
        }).toThrow('different executable check');
    },
);

test('manifest collection refuses circular replacement before either check can suppress execution', () => {
    const project = manifest('project');
    const original = configurationManifests()
        .get('bash')!
        .checks.find((check) => check.command !== undefined)!;
    project.checks = [
        { ...original, name: 'project/first', takes_over: 'project/second' },
        { ...original, name: 'project/second', takes_over: 'project/first' },
    ];
    expect(() => {
        validateManifests(new Map([['project', project]]));
    }).toThrow('project/first -> project/second -> project/first');
});

test('takeover declarations reject unknown readers and accept every declared reader', () => {
    const definition = (reader: string) => `
[configuration]
name = "example"
kind = "language"
title = "Example"
description = "Configuration adoption for the example language."
[[tools]]
name = "example"
version = "1.0.0"
[[tools.takeover]]
file = ".example"
carries = "${reader}"
`;
    expect(() => parseManifest(definition('executable-script'), 'configurations/example')).toThrow();
    for (const reader of ['ignore-paths', 'rules-table', 'words', 'advisories', 'licenses', 'eslint-config'])
        expect(() => parseManifest(definition(reader), 'configurations/example')).not.toThrow();
});

test('shared takeover selectors cannot authorize retiring the containing file', () => {
    const definition = (selection: string) => `
[configuration]
name = "example"
kind = "language"
title = "Example"
description = "Configuration adoption for the example language."
[[tools]]
name = "example"
version = "1.0.0"
[[tools.takeover]]
file = "package.json"
carries = "eslint-config"
${selection}
`;
    for (const selection of [
        'key = "eslintConfig"',
        'table = "tool.ruff"',
        'key = "eslintConfig"\ntable = "tool.ruff"\nshared = true',
    ])
        expect(() => parseManifest(definition(selection), 'configurations/example')).toThrow();
    expect(() =>
        parseManifest(definition('key = "eslintConfig"\nshared = true'), 'configurations/example'),
    ).not.toThrow();
});

test.each(['latest', '^1.2.3', '../pack'])(
    'query-pack metadata refuses an unpinned version %s and accepts an exact release',
    (version) => {
        const source = (pin: string) => `
[configuration]
name = "security"
kind = "policy"
title = "Security"
description = "Pinned query packs used by security analysis."
[[tools]]
name = "codeql"
version = "2.24.3"
query_packs = {python = "${pin}"}
`;
        expect(() => parseManifest(source(version), 'packages/cli/configurations/policy/security')).toThrow();
        expect(() => parseManifest(source('1.7.8'), 'packages/cli/configurations/policy/security')).not.toThrow();
    },
);

test.each(['missing/check', 'bash/shfmt'])(
    'takeover refuses destination %s and accepts the check that executes its tool',
    (destination) => {
        const manifests = structuredClone(configurationManifests());
        const row = manifests.get('bash')!.tools.find((tool) => tool.name === 'shellcheck')!.takeover![0]!;
        row.check = destination;
        expect(() => {
            validateManifests(manifests);
        }).toThrow('must execute shellcheck');
        row.check = 'bash/shellcheck';
        expect(() => {
            validateManifests(manifests);
        }).not.toThrow();
    },
);

test('check references require one standalone built-in owner and preserve its definition', () => {
    const owner = manifest('owner');
    const consumer = manifest('consumer');
    const spec = configurationManifests()
        .get('structure')!
        .checks.find((check) => check.name === 'integrity/allowlists-match')!;
    if (spec.engine !== 'integrity') throw new Error('Expected an integrity check fixture.');
    owner.checks = [{ ...spec, name: 'owner/shared' }];
    consumer.configuration.check_references = ['owner/shared'];
    const manifests = new Map([
        ['owner', owner],
        ['consumer', consumer],
    ]);
    expect(() => {
        validateManifests(manifests);
    }).not.toThrow();
    consumer.configuration.check_references = ['missing/shared'];
    expect(() => {
        validateManifests(manifests);
    }).toThrow('Referenced check');
    consumer.configuration.check_references = ['owner/shared'];
    owner.checks[0] = { ...owner.checks[0]!, runs: 'per-scope' };
    expect(() => {
        validateManifests(manifests);
    }).toThrow('standalone built-in');
    owner.checks[0] = { ...spec, name: 'owner/shared', tool: 'scanner' };
    expect(() => {
        validateManifests(manifests);
    }).toThrow('standalone built-in');
});

test.each([undefined, '', ' '.repeat(3)])('shipped checks reject an absent or blank example: %s', (example) => {
    const definition = `[configuration]
name = "example"
kind = "tool"
title = "Example"
description = "Validates the supplied project input."
[[checks]]
name = "example/parse"
level = "recommended"
stage = "commit"
command = ["parser"]
summary = "Parses the supplied project input."
why = "Invalid input cannot execute."
help = "Correct the input at the reported location."
`;
    const field = example === undefined ? '' : `example = ${JSON.stringify(example)}\n`;
    expect(() => parseManifest(definition + field, 'configurations/example')).toThrow('example');
    expect(() =>
        parseManifest(
            definition + 'example = "Close the unclosed input object and rerun."\n',
            'configurations/example',
        ),
    ).not.toThrow();
});
