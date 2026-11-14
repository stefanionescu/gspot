import { test, expect } from 'bun:test';
import { matchFields } from '#tests/setup/matchers.ts';
import type { GspotError } from '#cli/system/errors.ts';
import { isWindows } from '#tests/setup/system/platform.ts';
import { readCacheFolder } from '#cli/system/environment.ts';
import { overrideEnvironment } from '#tests/setup/system/environment.ts';

test('a relative cache folder setting is refused', () => {
    const name = isWindows ? 'LOCALAPPDATA' : 'XDG_CACHE_HOME';
    using _environment = overrideEnvironment({ XDG_CACHE_HOME: undefined, [name]: 'cache' });
    expect(() => readCacheFolder()).toThrow(matchFields<GspotError>({ name: 'GspotError', code: 'filesystem' }));
});
