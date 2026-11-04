import { test, expect } from 'bun:test';
import { captureRejection } from '#tests/setup/matchers.ts';
import { SWIFT_DEPENDENCY_CALLS } from '#tests/config/parsers/formats.ts';
import { DEPENDENCY_FILE_PARSERS } from '#cli/parsers/projects/dependencies.ts';

test('Swift dependencies include package calls and exclude comments, strings, local paths, and binary targets', async () => {
    const parsed = await DEPENDENCY_FILE_PARSERS.get('Package.swift')!('Package.swift', SWIFT_DEPENDENCY_CALLS);
    expect(parsed.dependencies).toStrictEqual({ live: 'https://example.com/live.git' });
    expect(parsed.installed).toStrictEqual(parsed.dependencies);
});

test.each(['./local-package'])('pyproject names an invalid requirement and its fix: %s', async (spec) => {
    const parsed = Promise.try(() =>
        DEPENDENCY_FILE_PARSERS.get('pyproject.toml')!(
            'services/api/pyproject.toml',
            `[project]\ndependencies = [${JSON.stringify(spec)}]\n`,
        ),
    );
    const error = await captureRejection(parsed);
    expect(error).toMatchObject({ name: 'GspotError', code: 'parse' });
    expect(error.message).toContain(`services/api/pyproject.toml: ${spec}`);
});
