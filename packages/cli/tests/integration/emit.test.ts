import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { writeFileSync } from 'node:fs';
import { createSandbox } from '@gspot/testing';
import { emitAll } from '#cli/emit/targets.ts';
import { openSession } from '#cli/run/session.ts';

test.each([
    ['cloudflare', 'workers'],
    ['express', 'express'],
    ['fastapi', 'fastapi'],
    ['supabase', 'supabase'],
])('%s security output follows the selected security preset', async (preset, name) => {
    await using sandbox = await createSandbox({
        'gspot.toml': `version = 1\npresets = ["${preset}"]\n`,
    });
    const target = `.gspot/semgrep/${name}.yml`;
    const plainOutput = emitAll(await openSession(sandbox.path));
    expect(plainOutput.files.map((file) => file.path)).not.toContain(target);
    writeFileSync(join(sandbox.path, 'gspot.toml'), `version = 1\npresets = ["${preset}", "security"]\n`);
    const securityOutput = emitAll(await openSession(sandbox.path));
    const configuration = securityOutput.files.find((file) => file.path === target);
    expect(configuration?.content).toContain('rules:');
});
