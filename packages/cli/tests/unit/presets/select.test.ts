import { describe, expect, test } from 'bun:test';
import type { Manifest } from '#types/manifest.ts';
import { selectPresets } from '#cli/presets/select.ts';
import { parseManifest, presetManifests } from '#cli/presets/read-manifests.ts';

function manifest(presetName: string, requires: string[] = []): Manifest {
    return parseManifest(
        `[preset]\nname = "${presetName}"\nkind = "language"\ntitle = "${presetName}"\nrequires = ${JSON.stringify(requires)}\ndescription = "A preset for the tests, long enough."\n`,
        `presets/${presetName}`,
    );
}

describe('selectPresets', () => {
    test('pulls required presets in, dependencies first, in order of first mention', () => {
        const ids = selectPresets(['typescript'], presetManifests()).map((entry) => entry.preset.name);
        expect(ids.indexOf('structure')).toBeLessThan(ids.indexOf('javascript'));
        expect(ids.indexOf('javascript')).toBeLessThan(ids.indexOf('typescript'));
        expect(ids).toEqual(['structure', 'javascript', 'typescript']);
    });

    test('a recommended preset is not pulled in by selection; init adds it and a person can drop it', () => {
        const manifests = presetManifests();
        expect(manifests.get('typescript')?.preset.recommends).toEqual(['naming', 'formatting', 'spelling']);
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
    test('refuses a check with no stage or an empty summary', () => {
        expect(() =>
            parseManifest(
                '[preset]\nname = "x"\nkind = "tool"\ntitle = "x"\ndescription = "A preset for the tests, long enough."\n[[checks]]\nname = "x/y"\ncommand = ["x"]\nsummary = ""\nwhy = "A sentence long enough."\nhelp = "A sentence long enough."\n',
                'presets/x',
            ),
        ).toThrow('not valid');
    });

    test('refuses a fix_command without a fix_order', () => {
        expect(() =>
            parseManifest(
                '[preset]\nname = "x"\nkind = "tool"\ntitle = "x"\ndescription = "A preset for the tests, long enough."\n[[checks]]\nname = "x/y"\nstage = "commit"\ncommand = ["x"]\nfix_command = ["x", "--fix"]\nsummary = "A sentence long enough."\nwhy = "A sentence long enough."\nhelp = "A sentence long enough."\n',
                'presets/x',
            ),
        ).toThrow('fix_order');
    });

    test('every shipped manifest loads and its folder equals its name', () => {
        for (const [presetName, entry] of presetManifests()) expect(entry.dir.endsWith(`/${presetName}`)).toBe(true);
    });
});

test('manifest definitions use the canonical advice and coverage fields', () => {
    const source = `[preset]
name = "fixture"
kind = "tool"
title = "Fixture"
description = "A correction contract fixture."
[[checks]]
name = "fixture/correction"
stage = "commit"
command = ["tool", "check"]
summary = "Checks a fixture source file."
why = "The fixture must satisfy its contract."
help = "Review the fixture source file."
coverage = ["syntax"]
`;
    expect(parseManifest(source, 'presets/fixture').preset.name).toBe('fixture');
    expect(() => parseManifest(source.replace('kind =', 'conflicts = ["other"]\nkind ='), 'presets/fixture')).toThrow(
        'conflicts',
    );
    expect(parseManifest(source, 'presets/fixture').checks[0]?.coverage).toEqual(['syntax']);
    expect(() => parseManifest(source.replace('coverage =', 'inspection ='), 'presets/fixture')).toThrow('not valid');
    const required = `${source}[coverage]\nfixture = ["syntax"]\n`;
    expect(parseManifest(required, 'presets/fixture').coverage).toEqual({ fixture: ['syntax'] });
    expect(() => parseManifest(required.replace('[coverage]', '[inspections]'), 'presets/fixture')).toThrow(
        'not valid',
    );
    expect(() => parseManifest(source.replace('name =', 'id ='), 'presets/fixture')).toThrow('not valid');
    expect(parseManifest(source, 'presets/fixture').checks[0]?.help).toBe('Review the fixture source file.');
    expect(() => parseManifest(source.replace('help =', 'fix ='), 'presets/fixture')).toThrow('not valid');
    expect(() => parseManifest(`${source}fix_command = []\nfix_order = "format"`, 'presets/fixture')).toThrow(
        'not valid',
    );
});
