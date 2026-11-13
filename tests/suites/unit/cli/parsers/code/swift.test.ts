import { expect, test } from 'bun:test';

import { detectSwiftTags } from '#cli/parsers/code/swift.ts';
import { SWIFT_TAG_CASES } from '#tests/config/repository.ts';

test.each([...SWIFT_TAG_CASES])(
    'a Swift $name gives the $tag tag only outside comments and strings',
    async ({ path, source, tag, tagged }) => {
        const tags = await detectSwiftTags(path, source);
        expect(tags.includes(tag)).toBe(tagged);
    },
);
