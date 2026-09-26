import { tmpdir } from 'node:os';
import { join, posix } from 'node:path';
import { scopeOf } from '#cli/repository/scopes.ts';
import type { Finding } from '#cli/checks/result.ts';
import { readSource } from '#cli/repository/tracked.ts';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { runCheckCommand } from '#cli/execution/tool-runner.ts';
import { nginxDirectives } from '#cli/checks/nginx/directives.ts';
import { nginxTestArguments } from '#cli/checks/nginx/test-plan.ts';
import type { EngineInput, EngineOutcome } from '#cli/checks/input.ts';

const MAIN_FILE = 'nginx.conf';
const DEFAULT_IMAGE = 'nginx:stable-alpine';
const CERTIFICATE_ARGUMENTS = ['req', '-x509', '-nodes', '-newkey', 'rsa:2048', '-subj', '/CN=localhost', '-days', '1'];

async function tested(input: EngineInput, path: string, work: string, image: string): Promise<EngineOutcome> {
    const directory = mkdtempSync(join(work, 'configuration-'));
    const configurations = new Map<string, { path: string; source: string; target: string; text: string }>();
    const pending = [{ path, target: '/etc/nginx/nginx.conf' }];
    const base = posix.dirname(path);
    for (const entry of pending) {
        if (configurations.has(entry.target)) continue;
        const source = join(directory, `${String(configurations.size)}.conf`);
        const bytes = readSource(input.root, entry.path, input.observations);
        writeFileSync(source, bytes);
        const text = bytes.toString('utf8');
        configurations.set(entry.target, { ...entry, source, text });
        for (const [name, value] of nginxDirectives(text)) {
            if (name !== 'include' || value === undefined || value.includes('$')) continue;
            const target = posix.resolve('/etc/nginx', value);
            const pattern = new Bun.Glob(posix.normalize(posix.join(base, posix.relative('/etc/nginx', target))));
            for (const file of input.files) {
                if (!pattern.match(file.path)) continue;
                pending.push({ path: file.path, target: posix.resolve('/etc/nginx', posix.relative(base, file.path)) });
            }
        }
    }
    const mounts = {
        configs: [...configurations.values()],
        certificate: join(work, 'certificate.pem'),
        key: join(work, 'key.pem'),
    };
    const argv = nginxTestArguments([...configurations.values()].map((entry) => entry.text).join('\n'), mounts, image);
    const result = await runCheckCommand(input, ['docker', ...argv], { cwd: input.root });
    if (result.code === 0) {
        const parsed = [...result.stdout.matchAll(/^# configuration file (?<path>[^\n]+):\r?$/gmu)].map(
            (match) => match.groups!['path']!,
        );
        if (!parsed.includes('/etc/nginx/nginx.conf'))
            throw new Error('nginx produced no configuration dump confirming the tested source.');
        return {
            findings: [],
            checkedFiles: parsed.flatMap((target) => {
                const configuration = configurations.get(target);
                return configuration === undefined ? [] : [configuration.path];
            }),
        };
    }
    const said = result.stderr.split('\n').find((line) => line.includes('[emerg]'));
    if (result.code !== 1 || said === undefined)
        throw new Error(`nginx could not run (exit ${String(result.code)}): ${result.stderr.trim()}`);
    const location = / in (?<file>\/[^\n]+):(?<line>\d+)\s*$/u.exec(said)?.groups;
    const file = configurations.get(location?.['file'] ?? '')?.path ?? path;
    const line = location?.['line'];
    return {
        findings: [
            { check: input.spec.name, file, line: Number(line ?? 1), rule: 'nginx-t', message: said, fixable: false },
        ],
        checkedFiles: configurations.has(location?.['file'] ?? '') ? [file] : [],
    };
}

/**
 * Tests every tracked nginx.conf with the server's own parser.
 * @param input the engine input
 * @returns one finding for each file nginx refuses
 */
export async function nginxTest(input: EngineInput): Promise<EngineOutcome> {
    const image = (input.view.tool('nginx')['image'] as string | undefined) ?? DEFAULT_IMAGE;
    const scopes = input.scopeEntries;
    const paths = input.files
        .map((file) => file.path)
        .filter(
            (path) =>
                (path === MAIN_FILE || path.endsWith(`/${MAIN_FILE}`)) && scopeOf(path, scopes).path === input.scope,
        );
    if (paths.length === 0) return { findings: [], checkedFiles: [] };
    const work = mkdtempSync(join(tmpdir(), 'gspot-nginx-'));
    try {
        const made = await runCheckCommand(
            input,
            [
                'openssl',
                ...CERTIFICATE_ARGUMENTS,
                '-keyout',
                join(work, 'key.pem'),
                '-out',
                join(work, 'certificate.pem'),
            ],
            { cwd: work },
        );
        if (made.code !== 0) throw new Error('The openssl command could not write the throwaway certificate.');
        const findings: Finding[] = [];
        const checkedFiles = new Set<string>();
        for (const path of paths) {
            const outcome = await tested(input, path, work, image);
            findings.push(...outcome.findings);
            for (const file of outcome.checkedFiles) checkedFiles.add(file);
        }
        return { findings, checkedFiles: [...checkedFiles] };
    } finally {
        rmSync(work, { recursive: true, force: true });
    }
}
