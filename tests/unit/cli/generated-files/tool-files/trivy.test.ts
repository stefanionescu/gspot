import { parse } from 'yaml';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { testdir, createFileTree } from 'testdirs';
import { generate } from '#cli/generation/generate.ts';
import { toolFileFor } from '#tests/setup/tool-files.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';

test('Trivy severity settings add up through the root and child scopes', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSettingsText(['docker'], {
            level: 'all',
            tables: '[tools.trivy]\nseverity = ["LOW", "MEDIUM"]\n[[scope]]\npath = "child"\n\n[scope.tools.trivy]\nseverity = ["UNKNOWN"]\n',
        }),
        Dockerfile: 'FROM scratch\n',
        'child/Dockerfile': 'FROM scratch\n',
    });
    const session = await openSession(sandbox.path);
    const files = generate(session).files;
    for (const scope of ['', 'child']) {
        const text = files.find((file) => file.path === toolFileFor(session, 'trivy', scope))!.content;
        const parsed: unknown = parse(text);
        expect(parsed).toMatchObject({
            severity:
                scope === '' ? ['HIGH', 'CRITICAL', 'LOW', 'MEDIUM'] : ['HIGH', 'CRITICAL', 'LOW', 'MEDIUM', 'UNKNOWN'],
        });
    }
});
