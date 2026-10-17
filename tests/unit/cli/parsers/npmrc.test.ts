import { test, expect } from 'bun:test';
import { openNpmrcFile } from '#cli/parsers/npmrc.ts';
import { NPMRC_LIST_CRLF } from '#tests/data/checks/dependencies.ts';

test('an .npmrc edit reads a [] list, keeps Windows line endings and comments, and deletes a key', () => {
    const file = openNpmrcFile('.npmrc', NPMRC_LIST_CRLF);
    expect(file.getValue(['min-release-age-exclude'])).toBe('@acme/tools');
    file.set(['min-release-age-exclude'], ['@acme/tools', '@gspothq/cli']);
    file.set(['min-release-age'], '7');
    expect(file.getText()).toBe(
        '; registry settings\r\nmin-release-age-exclude[]=@acme/tools\r\nmin-release-age-exclude[]=@gspothq/cli\r\nregistry=https://registry.npmjs.org/\r\nmin-release-age=7\r\n',
    );
    file.set(['min-release-age'], undefined);
    expect(file.getValue(['min-release-age'])).toBeUndefined();
    expect(() => {
        file.set(['a', 'b'], '1');
    }).toThrow('.npmrc holds only top-level keys.');
});
