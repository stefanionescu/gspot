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

test('a generated configuration needs a reader in its manifest or the kit it needs', () => {
    const source =
        '[kit]\nname = "x"\nkind = "tool"\ntitle = "x"\ndescription = "A configuration for the tests, long enough."\n[[configs]]\ntemplate = "x.yml.tmpl"\ntarget = ".gspot/config/semgrep/x.yml"\n';
    expect(() => parseManifest(source, 'configurations/x')).toThrow('has no check that reads it');
    expect(() => parseManifest(`${source}needs = "security"\n`, 'configurations/x')).not.toThrow();
});
