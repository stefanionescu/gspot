import { configurationManifests, parseManifest, validateManifests } from '#cli/configurations/manifests.ts';
import { testManifest } from '#tests/support/cli/manifests.ts';
import { expect, test } from 'bun:test';

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
        const project = testManifest('project');
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
    const project = testManifest('project');
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
    const owner = testManifest('owner');
    const consumer = testManifest('consumer');
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
