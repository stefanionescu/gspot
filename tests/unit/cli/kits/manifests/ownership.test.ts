import { test, expect } from 'bun:test';
import { validateManifests } from '#cli/kits/problems.ts';
import { kitManifests, parseManifest } from '#cli/kits/manifests.ts';

const PINNED_HEADER = '[kit]\ntitle = "Pinned"\ndescription = "Pins one tool for the tests."\n';

test('every shipped manifest passes the checks across manifests', () => {
    expect(() => {
        validateManifests(kitManifests());
    }).not.toThrow();
});

test('two kits that declare one setting must give it one meaning and may differ only in its default', () => {
    const manifests = new Map(kitManifests());
    const fastapi = structuredClone(manifests.get('fastapi')!);
    const setting = manifests.get('openapi')!.settings.find((entry) => entry.name === 'tools.openapi.generate')!;
    fastapi.settings.push({ ...setting, type: 'boolean' });
    manifests.set('fastapi', fastapi);
    expect(() => {
        validateManifests(manifests);
    }).toThrow('setting tools.openapi.generate differs from its declaration in');
    fastapi.settings[fastapi.settings.length - 1] = { ...setting, default: 'fastapi' };
    expect(() => {
        validateManifests(manifests);
    }).not.toThrow();
});

test('manifest collection rejects an invalid replacement and accepts a different check', () => {
    const project = parseManifest(
        `[kit]\ntitle = "project"\nrequires = ${JSON.stringify([])}\ndescription = "A configuration for the tests, long enough."\n`,
        `kits/language/project`,
    );
    const checks = `
[[check]]
example = "A rejected input is corrected before rerunning the parser."
name = "parse"
level = "recommended"
stage = "commit"
command = ["tool"]
summary = "Parses the project input."
why = "Invalid input cannot run."
help = "Correct the reported input."
`;
    const owner = parseManifest(
        '[kit]\ntitle = "Owner"\ndescription = "Executes project validation."\n' + checks,
        'kits/tool/owner',
    );
    const executable = owner.checks[0]!;
    project.checks = [{ ...executable, name: 'project/description', replaces: 'project/missing' }];
    const manifests = new Map([
        ['project', project],
        ['owner', owner],
    ]);
    expect(() => {
        validateManifests(manifests);
    }).toThrow('project/missing');
    project.checks[0]!.replaces = 'project/description';
    expect(() => {
        validateManifests(manifests);
    }).toThrow('different check');
    project.checks[0]!.replaces = 'owner/parse';
    expect(() => {
        validateManifests(manifests);
    }).not.toThrow();
});

test('manifest collection refuses circular replacement before either check can suppress execution', () => {
    const project = parseManifest(
        `[kit]\ntitle = "project"\nrequires = ${JSON.stringify([])}\ndescription = "A configuration for the tests, long enough."\n`,
        `kits/language/project`,
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
        `[kit]\ntitle = "owner"\nrequires = ${JSON.stringify([])}\ndescription = "A configuration for the tests, long enough."\n`,
        `kits/language/owner`,
    );
    const consumer = parseManifest(
        `[kit]\ntitle = "consumer"\nrequires = ${JSON.stringify([])}\ndescription = "A configuration for the tests, long enough."\n`,
        `kits/language/consumer`,
    );
    const spec = kitManifests()
        .get('structure')!
        .checks.find((check) => check.name === 'structure/stale-allowlists')!;
    if (spec.command !== undefined) throw new Error('Expected a built-in check fixture.');
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
    owner.checks[0] = { ...owner.checks[0]!, runs: 'scope' };
    expect(() => {
        validateManifests(manifests);
    }).toThrow('standalone built-in');
    owner.checks[0] = { ...spec, name: 'owner/shared', tool: 'scanner' };
    expect(() => {
        validateManifests(manifests);
    }).toThrow('standalone built-in');
});

test.each([
    ['[[tool]]\nname = "unpinned"\nnpm = "unpinned"\n', 'has no version and no floor'],
    ['[[tool]]\nname = "low"\nversion = "1.0.0"\nfloor = "2.0.0"\nnpm = "low"\n', 'below its floor 2.0.0'],
])('a manifest whose tool is not pinned is refused: %s', (tools, text) => {
    const manifest = parseManifest(`${PINNED_HEADER}${tools}`, 'kits/tool/pinned');
    expect(() => {
        validateManifests(new Map([['pinned', manifest]]));
    }).toThrow(text);
});

// A manifest whose one check reads a setting with an empty default, waiting for whatever the test says.
const header = '[kit]\ntitle = "Waiting"\ndescription = "Reads a setting for the tests."\n';
const setting =
    '[[setting]]\nname = "tools.waiting.target"\ntype = "string"\ndirection = "neutral"\ndefault = ""\nsummary = "Where the tool looks."\n';
function waitingManifest(waits: string): void {
    const check = `[[check]]\nexample = "A wrong target is corrected before the tool runs again."\nname = "run"\nlevel = "recommended"\nstage = "commit"\ncommand = ["tool", "{setting:tools.waiting.target}"]\n${waits}summary = "Runs the tool."\nwhy = "The target matters."\nhelp = "Set the target."\n`;
    const manifest = parseManifest(`${header}${setting}${check}`, 'kits/tool/waiting');
    validateManifests(new Map([['waiting', manifest]]));
}

test('a check that reads an empty setting must wait for it, and a wait must name a declared setting', () => {
    expect(() => {
        waitingManifest('');
    }).toThrow('must wait for it');
    expect(() => {
        waitingManifest('when = {setting = "tools.waiting.other"}\n');
    }).toThrow('which no configuration declares');
    expect(() => {
        waitingManifest('when = {setting = "tools.waiting.target"}\n');
    }).not.toThrow();
});
