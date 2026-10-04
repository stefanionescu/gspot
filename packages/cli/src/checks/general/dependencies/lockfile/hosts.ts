import { posix } from 'node:path';
import { readSource } from '#cli/platform/source.ts';
import { findingAt } from '#cli/execution/finding.ts';
import { LOCKFILE_CLIENTS } from '#cli/config/repository/inventory.ts';
import type { Finding, EngineInput } from '#cli/types/execution/runtime.ts';
import { LOCKFILE_URL, NPM_DOWNLOAD, JAVASCRIPT_CLIENTS } from '#cli/config/checks/general/dependencies.ts';

function problem(url: URL, hosts: Set<string>): string | undefined {
    if (url.protocol !== 'https:') return `${url.href} is not HTTPS.`;
    return hosts.has(url.host) ? undefined : `${url.host} is not an allowed registry host.`;
}

function fileFindings(input: EngineInput, path: string, hosts: Set<string>): Finding[] {
    const lines = readSource(input.root, path, input.reads).toString('utf8').split('\n');
    // An npm lockfile also holds funding pages and deprecation notes; only its resolved field names a download.
    const isNpm = LOCKFILE_CLIENTS[posix.basename(path)] === 'npm';
    return lines.flatMap((text, index) =>
        (isNpm
            ? text.matchAll(NPM_DOWNLOAD).map((match) => match[1] ?? '')
            : text.matchAll(LOCKFILE_URL).map((match) => match[0])
        )
            .flatMap((url) => {
                const diagnostic = URL.canParse(url) ? problem(new URL(url), hosts) : undefined;
                if (diagnostic === undefined) return [];
                return [findingAt(input, { file: path, line: index + 1 }, 'host', diagnostic)];
            })
            .toArray(),
    );
}

/**
 * The findings of the lockfile host check over every tracked text lockfile.
 * @param input the engine input
 * @returns the findings
 */
export function lockfileHosts(input: EngineInput): Finding[] {
    const hosts = new Set(input.view.options('dependencies')['registry_hosts'] as string[] | undefined);
    const paths = input.files
        .map((file) => file.path)
        .filter((path) => {
            const name = posix.basename(path);
            const client = LOCKFILE_CLIENTS[name];
            return client !== undefined && JAVASCRIPT_CLIENTS.has(client) && name !== 'bun.lockb';
        });
    return paths.flatMap((path) => fileFindings(input, path, hosts));
}
