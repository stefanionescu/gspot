// The installed npm package supplies the security assets selected by each language owner.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { readFile } from 'node:fs/promises';
import { buildPolicy } from '#tests/harness/policy.ts';
import { runTestCommand } from '#tests/harness/command.ts';
import { SECURITY_FILES } from '#tests/config/packages/security.ts';
import { createConsumer, getPublishedRelease } from '#tests/harness/consumer.ts';

const release = getPublishedRelease();

test('installed language security packs use their configuration names', async () => {
    await using installation = await createConsumer(release.registry, release.version);
    const { root, command, offlineOptions } = installation;
    await createFileTree(root, {
        ...SECURITY_FILES,
        'gspot.toml': buildPolicy(['javascript', 'swift', 'security']),
    });
    const applied = await runTestCommand([...command, 'apply', '--json'], offlineOptions);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const directory = join(root, '.gspot/config/semgrep');
    expect(await readFile(join(directory, 'javascript.yml'), 'utf8')).toContain('gspot.javascript.no-eval');
    expect(await readFile(join(directory, 'swift.yml'), 'utf8')).toContain('gspot.swift.keychain-accessible-always');
    expect(await readFile(join(root, 'source.js'), 'utf8')).toBe(SECURITY_FILES['source.js']);
    expect(await readFile(join(root, 'Value.swift'), 'utf8')).toBe(SECURITY_FILES['Value.swift']);
});
