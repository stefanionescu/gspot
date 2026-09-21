// Planted repository for the nginx preset: a proxy target the request chooses.
import { createFileTree, testdir } from 'testdirs';
import { describe, expect, test } from 'bun:test';
import type { PlantedCase } from '#tests/types/acceptance.ts';
import { commitAll, install, PLANTED_TIMEOUT_MS, run, runPlanted, toolsPath } from '#tests/harness/planted.ts';

const INIT = [
    'init',
    '--yes',
    '--presets',
    'nginx',
    '--no-runner',
    '--no-ci',
    '--no-hooks',
    '--no-rules',
    '--no-install',
];
const server = (location: string): string =>
    `events {}\nhttp {\n    server_tokens off;\n    server {\n        listen 8080;\n${location}    }\n}\n`;
const CLEAN = server('        location / {\n            return 204;\n        }\n');
const FORGED = server('        location ~ /proxy/(.*) {\n            proxy_pass http://$1;\n        }\n');

const CASES: PlantedCase[] = [{ check: 'nginx/gixy', files: { 'proxy/nginx.conf': FORGED }, expected: 'ssrf' }];

describe('the nginx preset', () => {
    test(
        'gixy finds the forged proxy target, and the container test waits for push',
        async () => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, { 'proxy/nginx.conf': CLEAN });
            commitAll(sandbox.path);
            const environment = { PATH: toolsPath(['gixy', 'typos', 'ec']) };
            await install(sandbox.path, INIT, environment);
            const selected = await run(sandbox.path, ['set', 'level', 'all'], environment);
            expect(selected.code, selected.stdout + selected.stderr).toBe(0);
            const clean = await run(sandbox.path, ['check', '--only', 'nginx/gixy', '--no-cache'], environment);
            expect(clean.code, clean.stdout + clean.stderr).toBe(0);
            for (const planted of CASES) {
                const outcome = await runPlanted(sandbox.path, planted, environment);
                if (process.platform === 'win32') {
                    expect(outcome.code, outcome.stdout + outcome.stderr).toBe(0);
                    expect(outcome.stdout).toMatch(/skipped\s+nginx\/gixy\s+\(platform\)/u);
                    continue;
                }
                expect(outcome.code, `${planted.check}: ${outcome.stdout}`).toBe(1);
                expect(outcome.stdout, planted.check).toContain(planted.expected);
                expect(outcome.stdout).toContain('proxy/nginx.conf:');
            }
            const checked = await run(sandbox.path, ['check', '--stage', 'commit', '--json'], environment);
            const atCommit = JSON.parse(checked.stdout) as {
                checks: { check: string }[];
            };
            expect(atCommit.checks.map((check) => check.check)).not.toContain('nginx/config-test');
        },
        PLANTED_TIMEOUT_MS * 2,
    );
});
