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

    test('a manifest rejects an unknown engine before planning checks', () => {
        const text =
            '[preset]\nname = "x"\nkind = "tool"\ntitle = "x"\ndescription = "A preset for the tests, long enough."\n[[checks]]\nname = "x/y"\nstage = "commit"\nengine = "nope"\nsummary = "A sentence long enough."\nwhy = "A sentence long enough."\nhelp = "A sentence long enough."\n';
        expect(() => parseManifest(text, 'presets/x')).toThrow('engine');
    });

    test('every shipped manifest loads and its folder equals its name', () => {
        for (const [presetName, entry] of presetManifests()) expect(entry.dir.endsWith(`/${presetName}`)).toBe(true);
    });
});
