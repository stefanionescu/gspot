import { readSource } from '#cli/repository/tracked.ts';
// Every URL a lockfile resolves from: HTTPS, and a host on the allowed list.
import type { EngineInput } from '#cli/types/execution.ts';
import type { Finding } from '#cli/types/reports.ts';
import { LOCKFILES } from '#cli/checks/dependencies/lockfile/formats.ts';

function problem(url: URL, hosts: Set<string>): string | undefined {
    if (url.protocol !== 'https:') return `${url.href} is not HTTPS.`;
    return hosts.has(url.host) ? undefined : `${url.host} is not an allowed registry host.`;
}

function fileFindings(input: EngineInput, path: string, hosts: Set<string>): Finding[] {
    const lines = readSource(input.root, path).toString('utf8').split('\n');
    return lines.flatMap((text, index) =>
        text
            .matchAll(LOCKFILE_URL)
            .flatMap((match) => {
                const said = URL.canParse(match[0]) ? problem(new URL(match[0]), hosts) : undefined;
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

const LOCKFILE_URL = /\b(?:https?|git\+https?|git\+ssh|git):\/\/[^\s"',)\]]+/gu;
