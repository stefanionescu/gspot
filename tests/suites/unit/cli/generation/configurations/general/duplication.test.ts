import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/planning/session.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { getConfigFilePath } from '#tests/setup/cli/generated-files.ts';
import { PYTHON_IMPORT_EXCLUSIONS } from '#tests/config/generation/configurations/general.ts';

test.each(PYTHON_IMPORT_EXCLUSIONS)(
    'jscpd import exclusions preserve executable code in $source',
    async ({ source, expected }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['python'], { level: 'all' }),
            'source.py': source,
        });
        const session = await openSession(sandbox.path);
        const file = buildGeneratedFiles(session).files.find(
            ({ path }) => path === getConfigFilePath(session, 'jscpd'),
        )!;
        const settings = JSON.parse(file.content) as { ignorePattern: string[] };
        let remaining: string = source;
        for (const pattern of settings.ignorePattern) remaining = remaining.replaceAll(new RegExp(pattern, 'gu'), '');
        expect(
            remaining
                .split('\n')
                .filter((line) => line.trim() !== '')
                .join('\n'),
        ).toBe(expected);
    },
);
