import { test, expect } from 'bun:test';
import { buildManifest } from '#tests/setup/manifest.ts';
import { parseManifest } from '#cli/configurations/manifests.ts';
import { FILE_PATH_REFERENCES } from '#tests/config/manifests.ts';

test('a manifest without [detect] takes the matchers of [files]', () => {
    const tables = '[files]\nfilenames = ["native.project"]\npaths = ["source/**"]\n';
    const inherited = buildManifest('native', { tables });
    expect(inherited.detect.filenames).toStrictEqual(['native.project']);
    expect(inherited.detect.paths).toStrictEqual(['source/**']);
    const explicit = buildManifest('native', {
        tables: '[detect]\nfilenames = ["explicit.project"]\n' + tables,
    });
    expect(explicit.detect.filenames).toStrictEqual(['explicit.project']);
    expect(explicit.detect.paths).toStrictEqual([]);
    const empty = buildManifest('native', { tables: '[detect]\n' + tables });
    expect(empty.detect.filenames).toStrictEqual([]);
    expect(empty.detect.paths).toStrictEqual([]);
});

test.each([...FILE_PATH_REFERENCES])('a file path setting reference "$path" is accepted: $accepted', ({ path }) => {
    const manifest = parseManifest(
        '[configuration]\ntitle = "Reader"\ndescription = "Select the authored source files."\n[files]\npaths = ' +
            JSON.stringify([path]) +
            '\n',
        'configurations/infrastructure/reader',
    );
    expect(manifest.files.paths).toStrictEqual([path]);
});
