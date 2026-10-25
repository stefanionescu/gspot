import { test, expect } from 'bun:test';
import { captureRejection } from '#tests/setup/matchers.ts';
import { DEPENDENCY_FILE_PARSERS } from '#cli/parsers/projects/dependencies.ts';
import { SWIFT_DEPENDENCY_CALLS } from '#tests/config/parsers/projects/dependencies.ts';

test('Swift dependencies include package calls and exclude comments, strings, local paths, and binary targets', async () => {
    const parsed = await DEPENDENCY_FILE_PARSERS.get('Package.swift')!('Package.swift', SWIFT_DEPENDENCY_CALLS);
    expect(parsed.dependencies).toStrictEqual({ live: 'https://example.com/live.git' });
    expect(parsed.installed).toStrictEqual(parsed.dependencies);
});

test.each(['./local-package', 'git+https://example.com/package.git'])(
    'pyproject names an invalid requirement and its fix: %s',
    async (spec) => {
        const parsed = Promise.try(() =>
            DEPENDENCY_FILE_PARSERS.get('pyproject.toml')!(
                'services/api/pyproject.toml',
                `[project]\ndependencies = [${JSON.stringify(spec)}]\n`,
            ),
        );
        expect(await captureRejection(parsed)).toMatchObject({
            code: 'filesystem',
            message: `services/api/pyproject.toml: ${spec} is not a PEP 508 requirement. Write it as name @ url, then run gspot again.`,
        });
    },
);
