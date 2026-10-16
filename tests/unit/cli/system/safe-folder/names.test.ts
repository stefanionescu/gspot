import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { openFiles } from '#cli/system/files/open.ts';
import { isWindows } from '#tests/setup/operating-systems.ts';
import { splitPortablePath } from '#cli/system/files/names.ts';
import { PORTABLE_PATH_ESCAPES } from '#tests/config/system.ts';

// Windows file names cannot contain a newline, quote, or colon.
test.skipIf(isWindows)(
    'the system path format keeps POSIX names the portable rules refuse, and refuses links to gspot state',
    async () => {
        await using directory = await testdir();
        using root = openFiles(directory.path, 'system');
        const path = 'folder/a\n"é:?.txt';
        const original = { bytes: Buffer.from('inside'), mode: 0o640 };
        root.write(path, original, undefined);
        expect(root.read(path)).toStrictEqual(original);
        expect(() => splitPortablePath(path)).toThrow('is not a safe repository-relative path');
        const link = { bytes: Buffer.from(path), mode: 0o777, isLink: true as const };
        root.write('linked', link, undefined);
        expect(root.readKeepingLinks('linked')).toStrictEqual(link);
        expect(() => {
            root.write('private-link', { ...link, bytes: Buffer.from('.gspot/state/ownership.json') }, undefined);
        }).toThrow('is inside .gspot/state');
    },
);

test.each(['../outside', '/outside', 'folder/../outside', 'nul\0suffix'])(
    'system paths refuse the escape %j',
    async (path) => {
        await using directory = await testdir();
        using root = openFiles(directory.path, 'system');
        expect(() => {
            root.write(path, { bytes: Buffer.from('inside'), mode: 0o640 }, undefined);
        }).toThrow('is not a safe repository-relative path');
    },
);

test.each([...PORTABLE_PATH_ESCAPES])('portable paths refuse the escape %j', (path) => {
    expect(() => splitPortablePath(path)).toThrow('is not a safe repository-relative path');
});

test('portable paths keep ordinary Unicode names', () => {
    expect(splitPortablePath('documents/équipe 50%.md')).toStrictEqual(['documents', 'équipe 50%.md']);
});
