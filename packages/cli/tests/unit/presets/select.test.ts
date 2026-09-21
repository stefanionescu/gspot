import { describe, expect, test } from 'bun:test';
import type { Manifest } from '#types/manifest.ts';
import { selectPresets } from '#cli/presets/select.ts';
import { parseManifest, presetManifests, validateManifests } from '#cli/presets/read-manifests.ts';

function manifest(presetName: string, requires: string[] = []): Manifest {
    return parseManifest(
        `[preset]\nname = "${presetName}"\nkind = "language"\ntitle = "${presetName}"\nrequires = ${JSON.stringify(requires)}\ndescription = "A preset for the tests, long enough."\n`,
        `presets/${presetName}`,
    );
}

describe('selectPresets', () => {
    test('pulls required presets in, dependencies first, in order of first mention', () => {
        const manifests = new Map([
            ['app', manifest('app', ['client', 'server'])],
            ['client', manifest('client', ['base'])],
            ['server', manifest('server', ['base'])],
            ['base', manifest('base')],
        ]);
        const ids = selectPresets(['app', 'client'], manifests).map((entry) => entry.preset.name);
        expect(ids).toEqual(['base', 'client', 'server', 'app']);
    });

    test('a recommended preset is not pulled in by selection; init adds it and a person can drop it', () => {
        const manifests = presetManifests();
        const ids = selectPresets(['bash'], manifests).map((entry) => entry.preset.name);
        expect(ids).not.toContain('naming');
    });

    test('an unknown preset names the near matches', () => {
        expect(() => selectPresets(['bassh'], presetManifests())).toThrow('Did you mean `bash`');
    });

    test('a circular requires fails with the chain', () => {
        const map = new Map([
            ['a', manifest('a', ['b'])],
            ['b', manifest('b', ['a'])],
        ]);
        expect(() => selectPresets(['a'], map)).toThrow('a -> b -> a');
    });
});

describe('parseManifest', () => {
    test('refuses a check without an enforcement level', () => {
        const text =
            '[preset]\nname = "x"\nkind = "tool"\ntitle = "x"\ndescription = "A preset for checking input."\n[[checks]]\nname = "x/parse"\nstage = "commit"\ncommand = ["x"]\nsummary = "Parses the project input."\nwhy = "Invalid input cannot run."\nhelp = "Correct the invalid input."\n';
        expect(() => parseManifest(text, 'presets/x')).toThrow('level');
    });

    test('refuses a check with no stage or an empty summary', () => {
        expect(() =>
            parseManifest(
                '[preset]\nname = "x"\nkind = "tool"\ntitle = "x"\ndescription = "A preset for the tests, long enough."\n[[checks]]\nlevel = "recommended"\nname = "x/y"\ncommand = ["x"]\nsummary = ""\nwhy = "A sentence long enough."\nhelp = "A sentence long enough."\n',
                'presets/x',
            ),
        ).toThrow('not valid');
    });

    test('refuses a fix_command without a fix_order', () => {
        expect(() =>
            parseManifest(
                '[preset]\nname = "x"\nkind = "tool"\ntitle = "x"\ndescription = "A preset for the tests, long enough."\n[[checks]]\nlevel = "recommended"\nname = "x/y"\nstage = "commit"\ncommand = ["x"]\nfix_command = ["x", "--fix"]\nsummary = "A sentence long enough."\nwhy = "A sentence long enough."\nhelp = "A sentence long enough."\n',
                'presets/x',
            ),
        ).toThrow('fix_order');
    });

    test('a manifest rejects an unknown engine before planning checks', () => {
        const text =
            '[preset]\nname = "x"\nkind = "tool"\ntitle = "x"\ndescription = "A preset for the tests, long enough."\n[[checks]]\nlevel = "recommended"\nname = "x/y"\nstage = "commit"\nengine = "nope"\nsummary = "A sentence long enough."\nwhy = "A sentence long enough."\nhelp = "A sentence long enough."\n';
        expect(() => parseManifest(text, 'presets/x')).toThrow('engine');
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
    const text = `[preset]
name = "x"
kind = "tool"
title = "Project input"
description = "Checks project input before execution."
[[checks]]
name = "x/parse"
level = "recommended"
stage = "commit"
${execution}
summary = "Parses project input before execution."
why = "Invalid project input cannot run."
help = "Correct the reported project input."
`;
    expect(() => parseManifest(text, 'presets/x')).toThrow('not valid');
});

test('loading two presets refuses duplicate executable check ownership', () => {
    const definition =
        '\n[[checks]]\nname = "project/parse"\nlevel = "recommended"\nstage = "commit"\ncommand = ["tool"]\nsummary = "Parses the project input."\nwhy = "Invalid input cannot run."\nhelp = "Correct the reported input."\n';
    const manifests = new Map(
        ['first', 'second'].map((name) => [
            name,
            parseManifest(
                `[preset]\nname = "${name}"\nkind = "tool"\ntitle = "Input"\ndescription = "Checks the project input."\n${definition}`,
                `presets/${name}`,
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
name = "project/parse"
level = "recommended"
stage = "commit"
command = ["tool"]
summary = "Parses the project input."
why = "Invalid input cannot run."
help = "Correct the reported input."
`;
        const owner = parseManifest(
            '[preset]\nname = "owner"\nkind = "tool"\ntitle = "Owner"\ndescription = "Executes project validation."\n' +
                checks,
            'presets/owner',
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
    const original = presetManifests()
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
