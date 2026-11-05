import { expect, test } from 'bun:test';
import { parse } from 'yaml';

import { openSession } from '#cli/engine/session.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { getManifestTarget } from '#tests/setup/cli/generated-files.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('swift/swiftlint writes each configured limit under its own rule', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['swift'], {
            level: 'all',
            tables: '[limits.swift]\nmax_file_lines = 50\nmax_type_lines = 40\nmax_function_lines = 30\nmax_closure_lines = 20\nmax_cyclomatic_complexity = 6\nmax_function_parameters = 5\n',
        }),
    });
    const session = await openSession(sandbox.path);
    const target = getManifestTarget('swift', 'swiftlint.yml');
    const generated = buildGeneratedFiles(session).files.find(({ path }) => path === target);
    expect(parse(generated!.content)).toMatchObject({
        file_length: { warning: 50, error: 50 },
        type_body_length: { warning: 40, error: 40 },
        function_body_length: { warning: 30, error: 30 },
        closure_body_length: { warning: 20, error: 20 },
        cyclomatic_complexity: { warning: 6, error: 6 },
        function_parameter_count: { warning: 5, error: 5 },
    });
});
