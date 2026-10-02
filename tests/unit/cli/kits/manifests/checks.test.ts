import { test, expect } from 'bun:test';
import { kitManifests, parseManifest } from '#cli/kits/manifests.ts';

test.each(['runs = "once"\ncommand = ["x", "{files}"]', 'command = ["x"]'])(
    'parseManifest > file isolation refuses an incomplete command declaration %s',
    (command) => {
        const source =
            '[kit]\nname = "x"\nkind = "tool"\ntitle = "x"\ndescription = "A configuration for the tests, long enough."\n[[check]]\nexample = "A rejected input is corrected before rerunning the parser."\nname = "x/y"\nlevel = "recommended"\nstage = "commit"\nisolated_files = true\nsummary = "A sentence long enough."\nwhy = "A sentence long enough."\nhelp = "A sentence long enough."\n';
        expect(() => parseManifest(`${source}${command}\n`, 'configurations/x')).toThrow('isolates files');
        expect(() => parseManifest(`${source}command = ["x", "{files}"]\n`, 'configurations/x')).not.toThrow();
        expect(() =>
            parseManifest(`${source}runs = "scope"\ncommand = ["x", "{root}"]\n`, 'configurations/x'),
        ).not.toThrow();
    },
);

test.each(['command = []', 'command = ["x"]\nengine = "integrity"'])(
    'manifest loading rejects an empty command or a field the check registry replaced: %s',
    (execution) => {
        const text = `[kit]
name = "x"
kind = "tool"
title = "Project input"
description = "Checks project input before execution."
[[check]]
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
    },
);

test('a generated configuration needs a reader in its manifest or the kit it needs', () => {
    const source =
        '[kit]\nname = "x"\nkind = "tool"\ntitle = "x"\ndescription = "A configuration for the tests, long enough."\n[[config]]\ntemplate = "x.yml.tmpl"\ntarget = ".gspot/config/semgrep/x.yml"\n';
    expect(() => parseManifest(source, 'configurations/x')).toThrow('has no check that reads it');
    expect(() => parseManifest(`${source}when = {kit = "security"}\n`, 'configurations/x')).not.toThrow();
});

test('every pinned tool a manifest command names is defined in that manifest', () => {
    const manifests = [...kitManifests().values()];
    const declared = new Set(manifests.flatMap((manifest) => manifest.tools.map((tool) => tool.name)));
    const undefinedTools = manifests.flatMap((manifest) =>
        manifest.checks
            .flatMap((check) => (check.command === undefined ? [] : [check.tool ?? check.command[0]!]))
            .filter((name) => !declared.has(name)),
    );
    expect([...new Set(undefinedTools)]).toStrictEqual([]);
});
