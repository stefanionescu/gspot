import { readSource } from '#cli/repository/tracked.ts';
import type { Finding, EngineInput } from '#cli/types/checks.ts';
import { LOCKFILES } from '#cli/config/repository/repository.ts';
import { LOCKFILE_URL, NPM_DOWNLOAD, NPM_LOCKFILES } from '#cli/config/checks/repository.ts';

function problem(url: URL, hosts: Set<string>): string | undefined {
    if (url.protocol !== 'https:') return `${url.href} is not HTTPS.`;
    return hosts.has(url.host) ? undefined : `${url.host} is not an allowed registry host.`;
}

function fileFindings(input: EngineInput, path: string, hosts: Set<string>): Finding[] {
    const lines = readSource(input.root, path, input.reads).toString('utf8').split('\n');
    // An npm lockfile also holds funding pages and deprecation notes; only its resolved field names a download.
    const isNpm = NPM_LOCKFILES.has(path.slice(path.lastIndexOf('/') + 1));
    return lines.flatMap((text, index) =>
        (isNpm
            ? text.matchAll(NPM_DOWNLOAD).map((match) => match[1] ?? '')
            : text.matchAll(LOCKFILE_URL).map((match) => match[0])
        )
            .flatMap((url) => {
                const said = URL.canParse(url) ? problem(new URL(url), hosts) : undefined;
                if (said === undefined) return [];
                return [
                    {
                        check: input.spec.name,
                        file: path,
                        line: index + 1,
                        rule: 'registry',
                        message: said,
                        fixable: false,
                    },
                ];
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
    const hosts = new Set(input.view.tool('dependencies')['registry_hosts'] as string[] | undefined);
    const paths = input.files
        .map((file) => file.path)
        .filter((path) => {
            const name = path.slice(path.lastIndexOf('/') + 1);
            return LOCKFILES[name] !== undefined && name !== 'bun.lockb';
        });
    return paths.flatMap((path) => fileFindings(input, path, hosts));
}
