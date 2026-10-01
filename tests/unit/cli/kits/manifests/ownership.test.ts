import { test, expect } from 'bun:test';
import { PINNED_HEADER } from '#tests/inputs/unit/cli/kits.ts';
import { validateManifests } from '#cli/kits/manifest-problems.ts';
import { kitManifests, parseManifest } from '#cli/kits/manifests.ts';

test('every shipped manifest passes the checks across manifests', () => {
    expect(() => {
        validateManifests(kitManifests());
    }).not.toThrow();
});

test('loading two configurations refuses duplicate executable check ownership', () => {
    const definition =
        '\n[[checks]]\nexample = "A rejected input is corrected before rerunning the parser."\nname = "project/parse"\nlevel = "recommended"\nstage = "commit"\ncommand = ["tool"]\nsummary = "Parses the project input."\nwhy = "Invalid input cannot run."\nhelp = "Correct the reported input."\n';
    const manifests = new Map(
        ['first', 'second'].map((name) => [
            name,
            parseManifest(
                `[kit]\nname = "${name}"\nkind = "tool"\ntitle = "Input"\ndescription = "Checks the project input."\n${definition}`,
                `kits/${name}`,
            ),
        ]),
    );
    expect(() => {
        validateManifests(manifests);
    }).toThrow('check project/parse is already owned by first');
});

test.each(['reported_by', 'replaces'] as const)(
    'manifest collection rejects invalid %s ownership and accepts a runnable owner',
    (field) => {
        const project = parseManifest(
            `[kit]\nname = "project"\nkind = "language"\ntitle = "project"\nrequires = ${JSON.stringify([])}\ndescription = "A configuration for the tests, long enough."\n`,
            `kits/project`,
        );
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
            '[kit]\nname = "owner"\nkind = "tool"\ntitle = "Owner"\ndescription = "Executes project validation."\n' +
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
    const project = parseManifest(
        `[kit]\nname = "project"\nkind = "language"\ntitle = "project"\nrequires = ${JSON.stringify([])}\ndescription = "A configuration for the tests, long enough."\n`,
        `kits/project`,
    );
    const original = kitManifests()
        .get('bash')!
        .checks.find((check) => check.command !== undefined)!;
    project.checks = [
        { ...original, name: 'project/first', replaces: 'project/second' },
        { ...original, name: 'project/second', replaces: 'project/first' },
    ];
    expect(() => {
        validateManifests(new Map([['project', project]]));
    }).toThrow('project/first -> project/second -> project/first');
});

test('check references require one standalone built-in owner and preserve its definition', () => {
    const owner = parseManifest(
        `[kit]\nname = "owner"\nkind = "language"\ntitle = "owner"\nrequires = ${JSON.stringify([])}\ndescription = "A configuration for the tests, long enough."\n`,
        `kits/owner`,
    );
    const consumer = parseManifest(
        `[kit]\nname = "consumer"\nkind = "language"\ntitle = "consumer"\nrequires = ${JSON.stringify([])}\ndescription = "A configuration for the tests, long enough."\n`,
        `kits/consumer`,
    );
    const spec = kitManifests()
        .get('structure')!
        .checks.find((check) => check.name === 'integrity/allowlists-match')!;
    if (spec.engine !== 'integrity') throw new Error('Expected an integrity check fixture.');
    owner.checks = [{ ...spec, name: 'owner/shared' }];
    consumer.kit.check_references = ['owner/shared'];
    const manifests = new Map([
        ['owner', owner],
        ['consumer', consumer],
    ]);
    expect(() => {
        validateManifests(manifests);
    }).not.toThrow();
    consumer.kit.check_references = ['missing/shared'];
    expect(() => {
        validateManifests(manifests);
    }).toThrow('Referenced check');
    consumer.kit.check_references = ['owner/shared'];
    owner.checks[0] = { ...owner.checks[0]!, runs: 'per-scope' };
    expect(() => {
        validateManifests(manifests);
    }).toThrow('standalone built-in');
    owner.checks[0] = { ...spec, name: 'owner/shared', tool: 'scanner' };
    expect(() => {
        validateManifests(manifests);
    }).toThrow('standalone built-in');
});

test.each([
    ['[[tools]]\nname = "unpinned"\nnpm = "unpinned"\n', 'has no version and no floor'],
    ['[[tools]]\nname = "low"\nversion = "1.0.0"\nfloor = "2.0.0"\nnpm = "low"\n', 'below its floor 2.0.0'],
])('a manifest whose tool is not pinned is refused: %s', (tools, text) => {
    const manifest = parseManifest(`${PINNED_HEADER}${tools}`, 'configurations/pinned');
    expect(() => {
        validateManifests(new Map([['pinned', manifest]]));
    }).toThrow(text);
});

// A manifest whose one check reads a setting with an empty default, waiting for whatever the test says.
const header =
    '[kit]\nname = "waiting"\nkind = "tool"\ntitle = "Waiting"\ndescription = "Reads a setting for the tests."\n';
const setting =
    '[[settings]]\nname = "tools.waiting.target"\nkind = "string"\ndirection = "neutral"\ndefault = ""\nsummary = "Where the tool looks."\n';
function waitingManifest(waits: string): void {
    const check = `[[checks]]\nexample = "A wrong target is corrected before the tool runs again."\nname = "waiting/run"\nlevel = "recommended"\nstage = "commit"\ncommand = ["tool", "{setting:tools.waiting.target}"]\n${waits}summary = "Runs the tool."\nwhy = "The target matters."\nhelp = "Set the target."\n`;
    const manifest = parseManifest(`${header}${setting}${check}`, 'configurations/waiting');
    validateManifests(new Map([['waiting', manifest]]));
}

test('a check that reads an empty setting must wait for it, and a wait must name a declared setting', () => {
    expect(() => {
        waitingManifest('');
    }).toThrow('must wait for it');
    expect(() => {
        waitingManifest('waits_for = "tools.waiting.other"\n');
    }).toThrow('which no configuration declares');
    expect(() => {
        waitingManifest('waits_for = "tools.waiting.target"\n');
    }).not.toThrow();
});
