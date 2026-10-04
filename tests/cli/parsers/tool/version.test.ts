import { test, expect } from 'bun:test';
import { buildBinaryPin } from '#tests/harness/pins.ts';
import { NO_VERSION } from '#cli/config/parsers/tool/version.ts';
import { parseVersionOutput } from '#cli/parsers/tool/version.ts';
import { VERSION_RESPONSE } from '#tests/config/cli/parsers/tool/version.ts';

test('package and mise metadata never conceal an unsuccessful version command', () => {
    const tool = buildBinaryPin('teller', '5.0.1', 'teller');
    expect(parseVersionOutput(tool, VERSION_RESPONSE, '5.0.1', '6.0.0')).toStrictEqual({ version: '5.0.1' });
    expect(parseVersionOutput(tool, { ...VERSION_RESPONSE, code: 7 }, '5.0.1', '6.0.0')).toStrictEqual({
        state: 'error',
        note: 'teller version inspection exited 7: tool 4.4.2',
    });
    expect(parseVersionOutput(tool, { ...VERSION_RESPONSE, stdout: NO_VERSION }, '5.0.1', '6.0.0')).toStrictEqual({
        state: 'missing',
        note: NO_VERSION,
    });
});

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
