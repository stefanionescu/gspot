import { join } from 'node:path';
import { homedir } from 'node:os';
import { test, expect } from 'bun:test';
import { setEnvironmentVariable } from '#tests/harness/environment.ts';
import { miseHome, environmentVariables } from '#cli/platform/environment.ts';
import { MISE_DIRECTORY_CASES } from '#tests/config/cli/platform/environment.ts';

for (const { name, mise, xdg, expected } of MISE_DIRECTORY_CASES)
    test(name, () => {
        const original = environmentVariables();
        setEnvironmentVariable('MISE_DATA_DIR', mise === undefined || mise === '' ? mise : join(homedir(), mise));
        setEnvironmentVariable('XDG_DATA_HOME', xdg === undefined || xdg === '' ? xdg : join(homedir(), xdg));
        try {
            expect(miseHome()).toBe(join(homedir(), ...expected));
        } finally {
            setEnvironmentVariable('MISE_DATA_DIR', original['MISE_DATA_DIR']);
            setEnvironmentVariable('XDG_DATA_HOME', original['XDG_DATA_HOME']);
        }
    });
