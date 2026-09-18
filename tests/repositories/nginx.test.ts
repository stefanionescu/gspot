// Planted repository for the nginx preset: a proxy target the request chooses.
import { createFixture } from 'fs-fixture';
import type { PlantedCase } from '#types/run.ts';
import { describe, expect, test } from 'bun:test';
import { commitAll, install, PLANTED_TIMEOUT_MS, run, runPlanted, toolsPath } from '#tests/harness/planted.ts';

const INIT = [
    'init',
    '--yes',
    '--presets',
    'nginx',
    '--runner',
    'none',
    '--ci',
    'none',
    '--hooks',
    'none',
    '--no-rules',
    '--no-install',
];
const server = (location: string): string =>
    `events {}\nhttp {\n    server_tokens off;\n    server {\n        listen 8080;\n${location}    }\n}\n`;
const CLEAN = server('        location / {\n            return 204;\n        }\n');
const FORGED = server('        location ~ /proxy/(.*) {\n            proxy_pass http://$1;\n        }\n');

const CASES: PlantedCase[] = [{ id: 'nginx/gixy', files: { 'proxy/nginx.conf': FORGED }, expected: 'ssrf' }];

describe('the nginx preset', () => {
    test(
        'gixy finds the forged proxy target, and the container test waits for push',
        async () => {
            await using fixture = await createFixture({ 'proxy/nginx.conf': CLEAN });
            commitAll(fixture.path);
            const environment = { PATH: toolsPath(['gixy', 'typos', 'ec']) };
            await install(fixture.path, INIT, environment);
            const clean = run(fixture.path, ['check', 'nginx/gixy', '--no-cache'], environment);
            expect(clean.code, clean.stdout + clean.stderr).toBe(0);
            for (const planted of CASES) {
                const outcome = await runPlanted(fixture.path, planted, environment);
                expect(outcome.code, `${planted.id}: ${outcome.stdout}`).toBe(1);
                expect(outcome.stdout, planted.id).toContain(planted.expected);
                expect(outcome.stdout).toContain('proxy/nginx.conf:');
            }
            const atCommit = JSON.parse(
                run(fixture.path, ['check', '--at', 'commit', '--json'], environment).stdout,
            ) as {
                checks: { id: string }[];
            };
            expect(atCommit.checks.map((check) => check.id)).not.toContain('nginx/config-test');
        },
        PLANTED_TIMEOUT_MS * 2,
    );
});
