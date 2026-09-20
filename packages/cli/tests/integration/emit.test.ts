import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { writeFileSync } from 'node:fs';
import { createFixture } from 'fs-fixture';
import { emitAll } from '#cli/emit/targets.ts';
import { openSession } from '#cli/run/session.ts';

test.each([
    ['cloudflare', 'workers'],
    ['express', 'express'],
    ['fastapi', 'fastapi'],
    ['supabase', 'supabase'],
])('%s security output follows the selected security preset', async (preset, name) => {
    await using fixture = await createFixture({
        'gspot.toml': `version = 1\npresets = ["${preset}"]\n`,
    });
    const target = `.gspot/semgrep/${name}.yml`;
    const plainOutput = emitAll(await openSession(fixture.path));
    expect(plainOutput.files.map((file) => file.path)).not.toContain(target);
    writeFileSync(join(fixture.path, 'gspot.toml'), `version = 1\npresets = ["${preset}", "security"]\n`);
    const securityOutput = emitAll(await openSession(fixture.path));
    const configuration = securityOutput.files.find((file) => file.path === target);
    expect(configuration?.content).toContain('rules:');
});
