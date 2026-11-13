import { expect, test } from 'bun:test';

import { parseProjectSources } from '#cli/parsers/projects/xcode/sources.ts';
import { parseBuildSettings } from '#cli/parsers/projects/xcode/targets.ts';
import type { GspotError } from '#cli/system/errors.ts';
import { matchFields } from '#tests/setup/matchers.ts';

test.each([{ parse: parseProjectSources }, { parse: parseBuildSettings }])(
    'invalid Xcode syntax names the file and its fix once',
    ({ parse }) => {
        expect(() => parse('{broken', 'App.xcodeproj/project.pbxproj')).toThrow(
            matchFields<GspotError>({
                name: 'GspotError',
                code: 'parse',
                message:
                    'App.xcodeproj/project.pbxproj is not a valid Xcode project: The Xcode project requires =. Fix the file, then run the command again.',
            }),
        );
    },
);
