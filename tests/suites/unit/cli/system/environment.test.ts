import { test, expect } from 'bun:test';
import { readCacheFolder } from '#cli/system/environment.ts';
import { fakePlatform } from '#tests/setup/system/platform.ts';
import { overrideEnvironment } from '#tests/setup/system/environment.ts';

test.each(['linux', 'win32'] as const)('a relative cache folder setting is refused on %s', (operatingSystem) => {
    using _operatingSystem = fakePlatform(operatingSystem);
    const name = operatingSystem === 'win32' ? 'LOCALAPPDATA' : 'XDG_CACHE_HOME';
    using _environment = overrideEnvironment({ XDG_CACHE_HOME: undefined, [name]: 'cache' });
    expect(() => readCacheFolder()).toThrow('must be an absolute path');
});
