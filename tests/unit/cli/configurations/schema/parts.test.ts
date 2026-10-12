import { test, expect } from 'bun:test';
import { INVALID_VERSION_FLOORS } from '#tests/config/manifests.ts';
import { versionFloorSchema } from '#cli/configurations/schema/parts.ts';

test.each(INVALID_VERSION_FLOORS)('a malformed version floor %s is refused', (floor) => {
    expect(versionFloorSchema.safeParse(floor)).toMatchObject({
        success: false,
        error: { issues: [{ code: 'invalid_format', format: 'regex' }] },
    });
});
