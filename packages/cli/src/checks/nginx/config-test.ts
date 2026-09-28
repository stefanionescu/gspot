import { tmpdir } from 'node:os';
import { join, posix } from 'node:path';
import { scopeOf } from '#cli/repository/scopes.ts';
import type { Mount } from '#cli/types/checks/nginx.ts';
import { readSource } from '#cli/repository/tracked.ts';
import { rmSync, mkdtempSync, writeFileSync } from 'node:fs';
import { runCheckCommand } from '#cli/execution/tool/runner.ts';
import { nginxDirectives } from '#cli/checks/nginx/directives.ts';
import { nginxTestArguments } from '#cli/checks/nginx/test-plan.ts';
import type { Finding, EngineInput, EngineOutcome } from '#cli/types/checks/checks.ts';
import { MAIN_FILE, DEFAULT_IMAGE, CERTIFICATE_ARGUMENTS } from '#cli/config/checks/nginx.ts';

// Include paths are resolved against the main configuration directory, matching nginx prefix semantics.
function includedConfigurations(input: EngineInput, text: string, base: string): Pick<Mount, 'path' | 'target'>[] {
    const included: Pick<Mount, 'path' | 'target'>[] = [];
    for (const [name, value] of nginxDirectives(text)) {
        if (name !== 'include' || value === undefined || value.includes('$')) continue;
        const target = posix.resolve('/etc/nginx', value);
        const pattern = new Bun.Glob(posix.normalize(posix.join(base, posix.relative('/etc/nginx', target))));
        for (const file of input.files.filter((candidate) => pattern.match(candidate.path)))
            included.push({ path: file.path, target: posix.resolve('/etc/nginx', posix.relative(base, file.path)) });
    }
    return included;
}

function configurationCopies(input: EngineInput, path: string, work: string): Map<string, Mount> {
    const directory = mkdtempSync(join(work, 'configuration-'));
    const configurations = new Map<string, Mount>();
    const pending = [{ path, target: '/etc/nginx/nginx.conf' }];
    const base = posix.dirname(path);
    for (const entry of pending) {
        if (configurations.has(entry.target)) continue;
        const source = join(directory, `${String(configurations.size)}.conf`);
        const bytes = readSource(input.root, entry.path, input.observations);
        writeFileSync(source, bytes);
        const text = bytes.toString('utf8');
        configurations.set(entry.target, { ...entry, source, text });
        pending.push(...includedConfigurations(input, text, base));
    }
    return configurations;
}

function configurationFailure(
    check: string,
    path: string,
    configurations: Map<string, Mount>,
    said: string,
): EngineOutcome {
    const { file: target = '', line = '1' } = / in (?<file>\/[^\n]+):(?<line>\d+)\s*$/u.exec(said)?.groups ?? {};
    const file = configurations.get(target)?.path ?? path;
    return {
        findings: [{ check, file, line: Number(line), rule: 'nginx-t', message: said, fixable: false }],
        checkedFiles: configurations.has(target) ? [file] : [],
    };
}

async function tested(input: EngineInput, path: string, work: string, image: string): Promise<EngineOutcome> {
    const configurations = configurationCopies(input, path, work);
    const mounts = {
        configs: [...configurations.values()],
        certificate: join(work, 'certificate.pem'),
        key: join(work, 'key.pem'),
    };
    const argv = nginxTestArguments([...configurations.values()].map((entry) => entry.text).join('\n'), mounts, image);
    const result = await runCheckCommand(input, ['docker', ...argv], { cwd: input.root });
    if (result.code === 0) {
        const parsed = [...result.stdout.matchAll(/^# configuration file (?<path>[^\n]+):\r?$/gmu)]
            .map((match) => match.groups?.['path'])
            .filter((path) => path !== undefined);
        if (!parsed.includes('/etc/nginx/nginx.conf'))
            throw new Error('The nginx run produced no configuration dump confirming the tested source.');
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
        throw new Error(`The nginx run failed (exit ${String(result.code)}): ${result.stderr.trim()}`);
    return configurationFailure(input.spec.name, path, configurations, said);
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
