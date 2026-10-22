import { test, expect } from 'bun:test';
import { spawnProcessBlocking } from '#cli/system/processes.ts';
import { overrideEnvironment } from '#tests/setup/system/environment.ts';
import { simulateOperatingSystem } from '#tests/setup/system/platform.ts';
import { readCacheFolder, readEnvironmentVariable } from '#cli/system/environment.ts';

test.each(['linux', 'win32'] as const)('a relative cache folder setting is refused on %s', (operatingSystem) => {
    using _operatingSystem = simulateOperatingSystem(operatingSystem);
    const name = operatingSystem === 'win32' ? 'LOCALAPPDATA' : 'XDG_CACHE_HOME';
    using _environment = overrideEnvironment({ [name]: 'cache' });
    expect(() => readCacheFolder()).toThrow('must be an absolute path');
});

// Only the Windows process environment folds names; a plain object does not.
test.if(process.platform === 'win32')('environment reads ignore name case in Bun and Node', () => {
    using _environment = overrideEnvironment({ GSPOT_TEST_NAME: 'native-case-folding' });
    expect(readEnvironmentVariable('gspot_test_name')).toBe('native-case-folding');
    const result = spawnProcessBlocking(['node', '--eval', 'process.stdout.write(process.env.gspot_test_name)'], {
        cwd: process.cwd(),
    });
    expect(result.code).toBe(0);
    expect(result.stdout).toBe('native-case-folding');
});
