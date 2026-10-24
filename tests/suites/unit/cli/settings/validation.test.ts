import { test, expect } from 'bun:test';
import { GspotError } from '#cli/system/errors.ts';
import { parseSettings } from '#cli/settings/read.ts';
import { createTemporaryFolder } from '#cli/system/files/folders.ts';
import { INVALID_SETTING_MESSAGES } from '#tests/config/settings/validation.ts';

test.each([...INVALID_SETTING_MESSAGES])('settings diagnostics locate $name', ({ text, message }) => {
    using sandbox = createTemporaryFolder();
    expect(() => parseSettings(text, sandbox.path)).toThrow(new GspotError('settings', message));
});
