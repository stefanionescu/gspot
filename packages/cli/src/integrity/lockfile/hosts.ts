// Every URL a lockfile resolves from: HTTPS, and a host on the allowed list.
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import type { EngineInput } from '#types/run.ts';
import type { Finding } from '#types/finding.ts';
import { LOCKFILES, LOCKFILE_URL } from '#config/integrity.ts';

function problem(url: URL, hosts: Set<string>): string | undefined {
    if (url.protocol !== 'https:') return `${url.href} is not HTTPS.`;
    return hosts.has(url.host) ? undefined : `${url.host} is not an allowed registry host.`;
}

function fileFindings(input: EngineInput, path: string, hosts: Set<string>): Finding[] {
    const lines = readFileSync(join(input.root, path), 'utf8').split('\n');
    return lines.flatMap((text, index) =>
        text
            .matchAll(LOCKFILE_URL)
            .flatMap((match) => {
                const said = URL.canParse(match[0]) ? problem(new URL(match[0]), hosts) : undefined;
                if (said === undefined) return [];
                return [
                    {
                        check: input.spec.id,
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
export function lockfileHosts(input: EngineInput): Promise<Finding[]> {
    const hosts = new Set(input.view.tool('dependencies')['registry_hosts'] as string[] | undefined);
    const paths = input.session.repository.files
        .map((file) => file.path)
        .filter((path) => {
            const name = path.slice(path.lastIndexOf('/') + 1);
            return LOCKFILES[name] !== undefined && name !== 'bun.lockb';
        });
    return Promise.resolve(paths.flatMap((path) => fileFindings(input, path, hosts)));
}
