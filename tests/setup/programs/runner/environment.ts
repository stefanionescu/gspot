import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { readEnvironmentVariable } from '#cli/system/environment.ts';

test('starts', () => {
    expect(readEnvironmentVariable('XDG_CACHE_HOME')).toStartWith(
        join(readEnvironmentVariable('TEST_RUN_FOLDER') ?? '', 'cache-'),
    );
    expect(readEnvironmentVariable('TMPDIR')).toStartWith(
        join(readEnvironmentVariable('TEST_RUN_FOLDER') ?? '', 'temporary-'),
    );
    expect(readEnvironmentVariable('MISE_STATE_DIR')).toBe(
        join(readEnvironmentVariable('TEST_RUN_FOLDER') ?? '', 'mise-state'),
    );
});
