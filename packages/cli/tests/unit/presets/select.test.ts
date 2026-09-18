import { describe, expect, test } from 'bun:test';
import type { Manifest } from '#types/manifest.ts';
import { selectPresets } from '#cli/presets/select.ts';
import { parseManifest, presetManifests } from '#cli/presets/read-manifests.ts';

function manifest(id: string, requires: string[] = [], conflicts: string[] = []): Manifest {
    return parseManifest(
        `[preset]\nid = "${id}"\nkind = "language"\ntitle = "${id}"\nrequires = ${JSON.stringify(requires)}\nconflicts = ${JSON.stringify(conflicts)}\ndescription = "A preset for the tests, long enough."\n`,
        `presets/${id}`,
    );
}

describe('selectPresets', () => {
    test('pulls required presets in, dependencies first, in order of first mention', () => {
        const ids = selectPresets(['bash'], presetManifests()).map((entry) => entry.preset.id);
        expect(ids.indexOf('structure')).toBeLessThan(ids.indexOf('bash'));
        for (const id of ['structure', 'naming', 'formatting', 'spelling', 'bash']) expect(ids).toContain(id);
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

    test('conflicting presets fail with both named', () => {
        const map = new Map([
            ['a', manifest('a', [], ['b'])],
            ['b', manifest('b')],
        ]);
        expect(() => selectPresets(['a', 'b'], map)).toThrow('`a` and `b` cannot be selected together');
    });
});

describe('parseManifest', () => {
    test('refuses a check with no stage or an empty summary', () => {
        expect(() =>
            parseManifest(
                '[preset]\nid = "x"\nkind = "tool"\ntitle = "x"\ndescription = "A preset for the tests, long enough."\n[[checks]]\nid = "x/y"\ncommand = ["x"]\nsummary = ""\nwhy = "A sentence long enough."\nfix = "A sentence long enough."\n',
                'presets/x',
            ),
        ).toThrow('not valid');
    });

    test('refuses a fix_command without a fix_order', () => {
        expect(() =>
            parseManifest(
                '[preset]\nid = "x"\nkind = "tool"\ntitle = "x"\ndescription = "A preset for the tests, long enough."\n[[checks]]\nid = "x/y"\nstage = "commit"\ncommand = ["x"]\nfix_command = ["x", "--fix"]\nsummary = "A sentence long enough."\nwhy = "A sentence long enough."\nfix = "A sentence long enough."\n',
                'presets/x',
            ),
        ).toThrow('fix_order');
    });

    test('every shipped manifest loads and its folder equals its id', () => {
        for (const [id, entry] of presetManifests()) expect(entry.dir.endsWith(`/${id}`)).toBe(true);
    });
});
