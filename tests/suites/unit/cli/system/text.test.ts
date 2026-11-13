import { expect, test } from 'bun:test';

import { formatNameState } from '#cli/system/text/messages.ts';

test('formatNameState writes is for one name and are for several', () => {
    expect(formatNameState(['astro'], 'not selected')).toBe('astro is not selected');
    expect(formatNameState(['astro', 'vue'], 'not selected')).toBe('astro and vue are not selected');
});
