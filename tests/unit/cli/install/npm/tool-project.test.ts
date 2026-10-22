import { test, expect } from 'bun:test';
import { NPM_TOOL_PROJECT } from '#cli/config/generation/projects.ts';
import { parseToolPackageJson } from '#cli/install/npm/tool-project.ts';
import { TOOL_REQUIREMENTS } from '#tests/data/install/npm/tool-project.ts';

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
