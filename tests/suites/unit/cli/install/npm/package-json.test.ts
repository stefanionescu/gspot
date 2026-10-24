import { test, expect } from 'bun:test';
import { parseToolPackageJson } from '#cli/install/npm/package-json.ts';
import { NPM_TOOL_PROJECT } from '#cli/config/generation/tool-projects.ts';
import { REFUSED_TOOL_REQUIREMENTS, ACCEPTED_TOOL_REQUIREMENTS } from '#tests/config/install/npm/package-json.ts';

test.each([...ACCEPTED_TOOL_REQUIREMENTS])('$name is accepted', ({ dependency, version }) => {
    const source = JSON.stringify({ ...NPM_TOOL_PROJECT, devDependencies: { [dependency]: version } });
    expect(parseToolPackageJson(source, 'bun').dependencies).toStrictEqual({ [dependency]: version });
});

test.each([...REFUSED_TOOL_REQUIREMENTS])('$name is refused', ({ dependency, version }) => {
    const source = JSON.stringify({ ...NPM_TOOL_PROJECT, devDependencies: { [dependency]: version } });
    expect(() => parseToolPackageJson(source, 'bun')).toThrow(
        new Error(
            JSON.stringify(
                [{ code: 'custom', path: ['devDependencies', dependency], message: 'Invalid input' }],
                null,
                2,
            ),
        ),
    );
});
