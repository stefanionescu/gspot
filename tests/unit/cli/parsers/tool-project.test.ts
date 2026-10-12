import { test, expect } from 'bun:test';
import { TOOL_REQUIREMENTS } from '#tests/config/npm.ts';
import { parseToolProject } from '#cli/parsers/tool-project.ts';
import { NPM_TOOL_PROJECT } from '#cli/config/parsers/dependency-files.ts';

test.each([...TOOL_REQUIREMENTS])('$name', ({ dependency, version, accepted }) => {
    const source = JSON.stringify({
        ...NPM_TOOL_PROJECT,
        devDependencies: { [dependency]: version },
    });
    if (accepted)
        expect(parseToolProject(source, { name: 'bun', version: '1.4.2' }).dependencies).toStrictEqual({
            [dependency]: version,
        });
    else expect(() => parseToolProject(source, { name: 'bun', version: '1.4.2' })).toThrow(dependency);
});
