import { parse } from 'yaml';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/planning/session.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';

test.each(['basic', 'all'] as const)('the Spectral config selects documentation rules at level %s', async (level) => {
    await using sandbox = await testdir({
        'openapi.yml': 'openapi: 3.1.0\n',
        'gspot.toml': buildSandboxSettings(['openapi'], { level, tables: '[openapi]\ndocument = "openapi.yml"\n' }),
    });
    const files = buildGeneratedFiles(await openSession(sandbox.path)).files;
    const spectral = files.find((file) => file.path.endsWith('/spectral.yml'))!;
    expect(parse(spectral.content)).toStrictEqual(
        level === 'all'
            ? { extends: ['spectral:oas'] }
            : {
                  extends: ['spectral:oas'],
                  rules: {
                      'info-contact': 'off',
                      'info-description': 'off',
                      'operation-description': 'off',
                      'operation-tags': 'off',
                  },
              },
    );
});
