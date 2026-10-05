// The installed archive supplies the security assets selected by each language owner.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { existsSync, readFileSync } from 'node:fs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { runTestCommand } from '#tests/harness/command.ts';
import { createConsumer } from '#tests/harness/consumer.ts';
import { getPublishedRelease } from '#tests/harness/release.ts';
import { NATIVE_TEST_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import { SECURITY_FILES } from '#tests/config/packages/security.ts';

const release = getPublishedRelease();

test(
    'installed language security packs use their configuration names and leave no obsolete assets',
    async () => {
        await using installation = await createConsumer(release.registry, release.version);
        const { root, command, offlineOptions } = installation;
        await createFileTree(root, {
            ...SECURITY_FILES,
            'gspot.toml': buildPolicy(['javascript', 'swift', 'security']),
        });
        const applied = await runTestCommand([...command, 'apply', '--json'], offlineOptions);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        const directory = join(root, '.gspot/config/semgrep');
        expect(readFileSync(join(directory, 'javascript.yml'), 'utf8')).toContain('gspot.javascript.no-eval');
        expect(readFileSync(join(directory, 'swift.yml'), 'utf8')).toContain('gspot.swift.keychain-accessible-always');
        expect(['node.yml', 'ios.yml'].map((file) => existsSync(join(directory, file)))).toStrictEqual([false, false]);
        expect(readFileSync(join(root, 'source.js'), 'utf8')).toBe(SECURITY_FILES['source.js']);
        expect(readFileSync(join(root, 'Value.swift'), 'utf8')).toBe(SECURITY_FILES['Value.swift']);
    },
    NATIVE_TEST_TIMEOUT_MS,
);
