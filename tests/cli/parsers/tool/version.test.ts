import { test, expect } from 'bun:test';
import { buildBinaryPin } from '#tests/harness/pins.ts';
import { parseVersionOutput } from '#cli/parsers/tool/contracts.ts';
import { VERSION_RESPONSE } from '#tests/config/cli/parsers/tool/version.ts';

test('native wrappers report their executable version when the package has a different version', () => {
    const tool = {
        ...buildBinaryPin('wrapper', '4.4.2', 'package'),
        installers: { npm: { name: 'package', version: '7.0.0' } },
    };
    expect(parseVersionOutput(tool, VERSION_RESPONSE, '7.0.0')).toStrictEqual({ version: '4.4.2' });
    expect(parseVersionOutput(tool, { ...VERSION_RESPONSE, stdout: 'no version' })).toStrictEqual({
        state: 'error',
        note: 'wrapper did not report a valid version: no version',
    });
});

test('color escapes and explicit version patterns are interpreted before version validation', () => {
    const tool = { ...buildBinaryPin('teller', '4.4.2'), version_pattern: String.raw`version=(\d+\.\d+\.\d+)` };
    expect(parseVersionOutput(tool, { ...VERSION_RESPONSE, stdout: '\u001B[32mversion=4.4.2\u001B[0m' })).toStrictEqual(
        { version: '4.4.2' },
    );
});
