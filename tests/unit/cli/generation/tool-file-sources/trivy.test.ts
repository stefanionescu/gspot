import { parse } from 'yaml';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/session.ts';
import { generate } from '#cli/generation/generate.ts';
import { settingsText } from '#tests/setup/settings.ts';

test('Trivy severity settings add up through the root and child scopes', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['docker'], {
            level: 'all',
            tables: '[tools.trivy]\nseverity = ["LOW", "MEDIUM"]\n[[scope]]\npath = "child"\n\n[scope.tools.trivy]\nseverity = ["UNKNOWN"]\n',
        }),
        Dockerfile: 'FROM scratch\n',
        'child/Dockerfile': 'FROM scratch\n',
    });
    const files = generate(await openSession(sandbox.path)).files;
    for (const scope of ['', 'child/']) {
        const text = files.find((file) => file.path === `.gspot/config/${scope}trivy.yml`)!.content;
        const parsed: unknown = parse(text);
        expect(parsed).toMatchObject({
            severity:
                scope === '' ? ['HIGH', 'CRITICAL', 'LOW', 'MEDIUM'] : ['HIGH', 'CRITICAL', 'LOW', 'MEDIUM', 'UNKNOWN'],
        });
    }
});
