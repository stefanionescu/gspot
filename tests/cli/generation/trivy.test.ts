import { parse } from 'yaml';
import { test, expect } from 'bun:test';
import { buildPolicy } from '#tests/harness/policy.ts';
import { emitFile } from '#tests/harness/generated.ts';

test('Trivy converts a duration to seconds and a severity string to its native list', async () => {
    const text = await emitFile(
        buildPolicy(['docker'], { tables: 'tool_timeout_seconds = 600\n[tools.trivy]\nseverity = "HIGH,CRITICAL"\n' }),
        '.gspot/config/trivy.yml',
        { Dockerfile: 'FROM scratch\n' },
    );
    const native: unknown = parse(text);
    expect(native).toMatchObject({ timeout: '600s', severity: ['HIGH', 'CRITICAL'] });
});
