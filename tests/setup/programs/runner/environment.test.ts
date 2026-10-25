import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { readEnvironmentVariable } from '#cli/system/environment.ts';

test('starts', () => {
    expect(readEnvironmentVariable('MISE_STATE_DIR')).toBe(
        join(readEnvironmentVariable('TEST_RUN_FOLDER') ?? '', 'mise-state'),
    );
});
