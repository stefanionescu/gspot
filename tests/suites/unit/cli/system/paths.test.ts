import { expect, test } from 'bun:test';

import type { GspotError } from '#cli/system/errors.ts';
import { buildArgumentPath } from '#cli/system/paths.ts';
import { matchFields } from '#tests/setup/matchers.ts';

test('a path argument outside the repository reports an arguments error', () => {
    expect(() => buildArgumentPath('/repo', '/repo/app', '../../outside')).toThrow(
        matchFields<GspotError>({
            name: 'GspotError',
            code: 'arguments',
            message: expect.stringContaining('../../outside') as string,
        }),
    );
});
