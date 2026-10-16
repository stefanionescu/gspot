import { test, expect } from 'bun:test';
import { readCacheFolder } from '#cli/system/environment.ts';
import { useEnvironment } from '#tests/setup/environment.ts';
import { useOperatingSystem } from '#tests/setup/operating-systems.ts';

test.each(['linux', 'win32'] as const)('a relative cache folder setting is refused on %s', (operatingSystem) => {
    using _operatingSystem = useOperatingSystem(operatingSystem);
    const name = operatingSystem === 'win32' ? 'LOCALAPPDATA' : 'XDG_CACHE_HOME';
    using _environment = useEnvironment({ [name]: 'cache' });
    expect(() => readCacheFolder()).toThrow('must be absolute');
});
