import { parse } from 'yaml';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/planning/session.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { getConfigFilePath } from '#tests/setup/cli/generated-files.ts';

test('Trivy severity replaces the shipped list and adds child scope values', async () => {
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
    const files = buildGeneratedFiles(session).files;
    for (const scope of ['', 'child']) {
        const text = files.find((file) => file.path === getConfigFilePath(session, 'trivy', scope))!.content;
        const parsed: unknown = parse(text);
        expect(parsed).toMatchObject({
            severity: scope === '' ? ['LOW', 'MEDIUM'] : ['LOW', 'MEDIUM', 'UNKNOWN'],
        });
    }
});
