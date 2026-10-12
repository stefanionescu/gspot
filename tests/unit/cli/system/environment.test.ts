import { join } from 'node:path';
import { homedir } from 'node:os';
import { test, expect } from 'bun:test';
import { MISE_FOLDERS } from '#tests/config/system.ts';
import { useEnvironment } from '#tests/setup/environment.ts';
import { miseHome, cacheDirectory } from '#cli/system/environment.ts';
import { useOperatingSystem } from '#tests/setup/operating-systems.ts';

test.each([...MISE_FOLDERS])('mise data folder: $name', ({ mise, xdg, expected }) => {
    using _environment = useEnvironment({
        MISE_DATA_DIR: mise === undefined || mise === '' ? mise : join(homedir(), mise),
        XDG_DATA_HOME: xdg === undefined ? xdg : join(homedir(), xdg),
    });
    expect(miseHome()).toBe(join(homedir(), ...expected));
});

test.each(['linux', 'win32'] as const)('a relative cache folder setting is refused on %s', (operatingSystem) => {
    using _operatingSystem = useOperatingSystem(operatingSystem);
    const name = operatingSystem === 'win32' ? 'LOCALAPPDATA' : 'XDG_CACHE_HOME';
    using _environment = useEnvironment({ [name]: 'cache' });
    expect(() => cacheDirectory()).toThrow('must be absolute');
});
