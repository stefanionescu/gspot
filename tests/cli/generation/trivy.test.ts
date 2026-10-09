import { parse } from 'yaml';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/public.ts';
import { openSession } from '#cli/commands/public.ts';
import { emitFile } from '#tests/harness/generated.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { settingValueSchemas } from '#cli/policy/schema/native/public.ts';

test('Trivy keeps typed severities and converts its duration to native seconds', async () => {
    const text = await emitFile(
        buildPolicy(['docker'], {
            tables: 'tool_timeout_seconds = 600\n[tools.trivy]\nseverity = ["HIGH", "CRITICAL"]\n',
        }),
        '.gspot/config/trivy.yml',
        { Dockerfile: 'FROM scratch\n' },
    );
    const native: unknown = parse(text);
    expect(native).toMatchObject({ timeout: '600s', severity: ['HIGH', 'CRITICAL'] });
});

test.each(['recommended', 'all'] as const)('%s keeps root and child Trivy severity overrides typed', async (level) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['docker'], {
            level,
            tables: '[tools.trivy]\nseverity = ["LOW", "MEDIUM"]\n[scope."child"]\n[scope."child".tools.trivy]\nseverity = ["UNKNOWN"]\n',
        }),
        Dockerfile: 'FROM scratch\n',
        'child/Dockerfile': 'FROM scratch\n',
    });
    const files = emitAll(await openSession(sandbox.path)).files;
    for (const scope of ['', 'child/']) {
        const text = files.find((file) => file.path === `.gspot/config/${scope}trivy.yml`)!.content;
        const native: unknown = parse(text);
        expect(native).toMatchObject({
            severity:
                scope === '' ? ['HIGH', 'CRITICAL', 'LOW', 'MEDIUM'] : ['HIGH', 'CRITICAL', 'LOW', 'MEDIUM', 'UNKNOWN'],
        });
    }
    const schema = settingValueSchemas['tools.trivy.severity'];
    expect(schema.safeParse('HIGH,CRITICAL').success).toBe(false);
    expect(schema.safeParse(['HIGH', false]).success).toBe(false);
    expect(schema.parse(['LOW', 'HIGH'])).toStrictEqual(['LOW', 'HIGH']);
});
