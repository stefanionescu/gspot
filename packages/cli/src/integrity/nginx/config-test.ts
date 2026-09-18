import { join } from 'node:path';
// nginx -t in a container over every main configuration file.
import { tmpdir } from 'node:os';
import { run } from '#cli/platform/spawn.ts';
import type { EngineInput } from '#types/run.ts';
import type { Finding } from '#types/finding.ts';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { nginxTestArguments } from '#cli/integrity/nginx/test-plan.ts';

const MAIN_FILE = 'nginx.conf';
const DEFAULT_IMAGE = 'nginx:stable-alpine';
const TEST_TIMEOUT_MS = 300_000;
const CERTIFICATE_ARGUMENTS = ['req', '-x509', '-nodes', '-newkey', 'rsa:2048', '-subj', '/CN=localhost', '-days', '1'];

async function tested(input: EngineInput, path: string, work: string, image: string): Promise<Finding[]> {
    const mounts = {
        config: join(input.root, path),
        certificate: join(work, 'certificate.pem'),
        key: join(work, 'key.pem'),
    };
    const argv = nginxTestArguments(readFileSync(mounts.config, 'utf8'), mounts, image);
    const result = await run(['docker', ...argv], { cwd: input.root, timeoutMs: TEST_TIMEOUT_MS });
    if (result.code === 0) return [];
    const said = result.stderr.split('\n').find((line) => line.includes('[emerg]')) ?? result.stderr.trim();
    const line = /:(?<line>\d+)\s*$/u.exec(said)?.groups?.['line'];
    return [
        { check: input.spec.id, file: path, line: Number(line ?? 1), rule: 'nginx-t', message: said, fixable: false },
    ];
}

/**
 * Tests every tracked nginx.conf with the server's own parser.
 * @param input the engine input
 * @returns one finding for each file nginx refuses
 */
export async function nginxTest(input: EngineInput): Promise<Finding[]> {
    const image = (input.view.tool('nginx')['image'] as string | undefined) ?? DEFAULT_IMAGE;
    const paths = input.session.repository.files
        .map((file) => file.path)
        .filter((path) => path === MAIN_FILE || path.endsWith(`/${MAIN_FILE}`));
    if (paths.length === 0) return [];
    const work = mkdtempSync(join(tmpdir(), 'gspot-nginx-'));
    try {
        const made = await run(
            [
                'openssl',
                ...CERTIFICATE_ARGUMENTS,
                '-keyout',
                join(work, 'key.pem'),
                '-out',
                join(work, 'certificate.pem'),
            ],
            { cwd: work, timeoutMs: TEST_TIMEOUT_MS },
        );
        if (made.code !== 0) throw new Error('The openssl command could not write the throwaway certificate.');
        const findings: Finding[] = [];
        for (const path of paths) findings.push(...(await tested(input, path, work, image)));
        return findings;
    } finally {
        rmSync(work, { recursive: true, force: true });
    }
}
