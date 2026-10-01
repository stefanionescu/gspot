import { test, expect } from 'bun:test';
import { parseManifest } from '#cli/kits/manifests.ts';

test.each(['runs = "once"\ncommand = ["x", "{files}"]', 'command = ["x"]'])(
    'parseManifest > file isolation refuses an incomplete command declaration %s',
    (command) => {
        const source =
            '[kit]\nname = "x"\nkind = "tool"\ntitle = "x"\ndescription = "A configuration for the tests, long enough."\n[[checks]]\nexample = "A rejected input is corrected before rerunning the parser."\nname = "x/y"\nlevel = "recommended"\nstage = "commit"\nisolated_files = true\nsummary = "A sentence long enough."\nwhy = "A sentence long enough."\nhelp = "A sentence long enough."\n';
        expect(() => parseManifest(`${source}${command}\n`, 'configurations/x')).toThrow('isolates files');
        expect(() => parseManifest(`${source}command = ["x", "{files}"]\n`, 'configurations/x')).not.toThrow();
        expect(() =>
            parseManifest(`${source}runs = "per-scope"\ncommand = ["x", "{root}"]\n`, 'configurations/x'),
        ).not.toThrow();
    },
);

test('parseManifest > refuses a check without an enforcement level', () => {
    const text =
        '[kit]\nname = "x"\nkind = "tool"\ntitle = "x"\ndescription = "A configuration for checking input."\n[[checks]]\nexample = "A rejected input is corrected before rerunning the parser."\nname = "x/parse"\nstage = "commit"\ncommand = ["x"]\nsummary = "Parses the project input."\nwhy = "Invalid input cannot run."\nhelp = "Correct the invalid input."\n';
    expect(() => parseManifest(text, 'configurations/x')).toThrow('level');
});

test('parseManifest > refuses a check with no stage or an empty summary', () => {
    expect(() =>
        parseManifest(
            '[kit]\nname = "x"\nkind = "tool"\ntitle = "x"\ndescription = "A configuration for the tests, long enough."\n[[checks]]\nexample = "A rejected input is corrected before rerunning the parser."\nlevel = "recommended"\nname = "x/y"\ncommand = ["x"]\nsummary = ""\nwhy = "A sentence long enough."\nhelp = "A sentence long enough."\n',
            'configurations/x',
        ),
    ).toThrow('not valid');
});

test('parseManifest > a manifest rejects an unknown engine before planning checks', () => {
    const text =
        '[kit]\nname = "x"\nkind = "tool"\ntitle = "x"\ndescription = "A configuration for the tests, long enough."\n[[checks]]\nexample = "A rejected input is corrected before rerunning the parser."\nlevel = "recommended"\nname = "x/y"\nstage = "commit"\nengine = "nope"\nsummary = "A sentence long enough."\nwhy = "A sentence long enough."\nhelp = "A sentence long enough."\n';
    expect(() => parseManifest(text, 'configurations/x')).toThrow('engine');
});

test.each([
    'command = []',
    'command = ["x"]\nengine = "integrity"',
    'command = ["x"]\nanalysis = "typescript"',
    'analysis = "typescript"',
    'tool = "tsc"\nanalysis = "unknown-analysis"',
    'reported_by = "x/owner"\ncommand = ["x"]',
    'reported_by = "x/owner"\nengine = "integrity"',
    'reported_by = "x/owner"\nfix_command = ["x"]',
])('manifest loading rejects an invalid execution form: %s', (execution) => {
    const text = `[kit]
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

test.each([undefined, '', ' '.repeat(3)])('shipped checks reject an absent or blank example: %s', (example) => {
    const definition = `[kit]
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
