import { parse } from 'yaml';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { generate } from '#cli/generation/generate.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { findConfigFilePath } from '#tests/setup/cli/config-files.ts';

test('Trivy severity settings add up through the root and child scopes', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['docker'], {
            level: 'all',
            scopes: [{ path: 'child' }],
            tables: '[tools.trivy]\nseverity = ["LOW", "MEDIUM"]\n\n[scope.tools.trivy]\nseverity = ["UNKNOWN"]\n',
        }),
        Dockerfile: 'FROM scratch\n',
        'child/Dockerfile': 'FROM scratch\n',
    });

    const session = await openSession(sandbox.path);
    const files = generate(session).files;
    for (const scope of ['', 'child']) {
        const text = files.find((file) => file.path === findConfigFilePath(session, 'trivy', scope))!.content;
        const parsed: unknown = parse(text);
        expect(parsed).toMatchObject({
            severity:
                scope === '' ? ['HIGH', 'CRITICAL', 'LOW', 'MEDIUM'] : ['HIGH', 'CRITICAL', 'LOW', 'MEDIUM', 'UNKNOWN'],
        });
    }
});
