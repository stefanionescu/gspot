import { test, expect } from 'bun:test';
import { parseToolPackageJson } from '#cli/install/npm/package-json.ts';
import { NPM_TOOL_PROJECT } from '#cli/config/generation/tool-projects.ts';
import { TOOL_REQUIREMENTS } from '#tests/config/install/npm/package-json.ts';

test.each([...TOOL_REQUIREMENTS])(
    'tool project validates the $dependency requirement $version: $name',
    ({ dependency, version, accepted }) => {
        const source = JSON.stringify({
            ...NPM_TOOL_PROJECT,
            devDependencies: { [dependency]: version },
        });
        if (accepted)
            expect(parseToolPackageJson(source, 'bun').dependencies).toStrictEqual({
                [dependency]: version,
            });
        else expect(() => parseToolPackageJson(source, 'bun')).toThrow(dependency);
    },
);
