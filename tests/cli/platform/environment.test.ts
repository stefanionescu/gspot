import { join } from 'node:path';
import { homedir } from 'node:os';
import { test, expect } from 'bun:test';
import { useEnvironment } from '#tests/harness/environment.ts';
import { miseHome, cacheDirectory } from '#cli/platform/public.ts';
import { MISE_DIRECTORY_CASES } from '#tests/config/cli/platform/environment.ts';

for (const { name, mise, xdg, expected } of MISE_DIRECTORY_CASES)
    test(name, () => {
        using _environment = useEnvironment({
            MISE_DATA_DIR: mise === undefined || mise === '' ? mise : join(homedir(), mise),
            XDG_DATA_HOME: xdg === undefined || xdg === '' ? xdg : join(homedir(), xdg),
        });
        expect(miseHome()).toBe(join(homedir(), ...expected));
    });

// macOS has one cache directory under the library folder, which no variable moves.
test.skipIf(process.platform === 'darwin')('a relative cache directory override is refused', () => {
    const name = process.platform === 'win32' ? 'LOCALAPPDATA' : 'XDG_CACHE_HOME';
    using _environment = useEnvironment({ [name]: 'cache' });
    expect(() => cacheDirectory()).toThrow('must be absolute');
});
