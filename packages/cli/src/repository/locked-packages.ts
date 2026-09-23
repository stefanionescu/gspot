import { parse as parseToml } from 'smol-toml';
import { parse as parseYaml } from 'yaml';
import { parseSyml } from '@yarnpkg/parsers';
import { z } from 'zod';
import { parseJsonc } from '#cli/repository/jsonc.ts';
import { normalizedPythonPackage } from '#cli/repository/python-package.ts';

const PACKAGE = z.object({ name: z.string().min(1), version: z.string().min(1) });
const VERSION = z.object({ version: z.string().optional(), name: z.string().optional() });

/** Read resolved package identities from supported textual dependency lockfiles. */
export function lockedPackages(filename: string, text: string): Set<string> {
    if (['uv.lock', 'poetry.lock', 'pdm.lock'].includes(filename)) {
        const lock = z.object({ package: z.array(PACKAGE) }).parse(parseToml(text));
        return new Set(lock.package.map(({ name, version }) => `${normalizedPythonPackage(name)}@${version}`));
    }
    if (filename === 'package-lock.json') {
        const parsed: unknown = JSON.parse(text);
        const version = z.object({ lockfileVersion: z.number() }).parse(parsed).lockfileVersion;
        if (version === 1) {
            const lock = z.object({ dependencies: z.record(z.string(), z.unknown()) }).parse(parsed);
            const pending = Object.entries(lock.dependencies);
            const identities = new Set<string>();
            while (pending.length > 0) {
                const item = pending.pop();
                if (item === undefined) break;
                const [name, value] = item;
                const entry = z
                    .object({ version: z.string(), dependencies: z.record(z.string(), z.unknown()).optional() })
                    .parse(value);
                identities.add(entry.version.startsWith('npm:') ? entry.version.slice(4) : `${name}@${entry.version}`);
                pending.push(...Object.entries(entry.dependencies ?? {}));
            }
            return identities;
        }
        const lock = z
            .object({ lockfileVersion: z.union([z.literal(2), z.literal(3)]), packages: z.record(z.string(), VERSION) })
            .parse(parsed);
        return new Set(
            Object.entries(lock.packages).flatMap(([path, entry]) => {
                if (entry.version === undefined) return [];
                const name = entry.name ?? path.split('node_modules/').at(-1);
                return name === undefined || name === '' ? [] : [`${name}@${entry.version}`];
            }),
        );
    }
    if (filename === 'bun.lock') {
        const lock = z
            .object({ packages: z.record(z.string(), z.tuple([z.string()]).rest(z.unknown())) })
            .parse(parseJsonc(text));
        return new Set(
            Object.values(lock.packages)
                .map(([identity]) => identity)
                .filter((identity) => /@[0-9]/u.test(identity)),
        );
    }
    if (filename === 'pnpm-lock.yaml') {
        const lock = z.object({ packages: z.record(z.string(), z.unknown()) }).parse(parseYaml(text));
        return new Set(
            Object.keys(lock.packages).map((key) => {
                const match = /^\/?(?<name>@[^/]+\/[^/@]+|[^/@]+)(?:@|\/)(?<version>[^(_]+)(?:[(_].*)?$/u.exec(
                    key,
                )?.groups;
                if (match?.['name'] === undefined || match['version'] === undefined)
                    throw new Error('Cannot read a resolved package identity from the pnpm lockfile.');
                return `${match['name']}@${match['version']}`;
            }),
        );
    }
    if (filename === 'yarn.lock') {
        const entries = z.record(z.string(), z.unknown()).parse(parseSyml(text));
        const lock = z
            .record(z.string(), VERSION.extend({ resolution: z.string().optional() }))
            .parse(Object.fromEntries(Object.entries(entries).filter(([name]) => name !== '__metadata')));
        return new Set(
            Object.entries(lock).flatMap(([descriptors, entry]) => {
                if (entry.version === undefined) return [];
                const descriptor = entry.resolution ?? descriptors.split(/,\s*/u)[0]!;
                const separator = descriptor.indexOf('@', 1);
                if (separator < 1) throw new Error('Cannot read a resolved package identity from the Yarn lockfile.');
                const reference = descriptor.slice(separator + 1);
                if (reference.startsWith('npm:')) {
                    const alias = reference.slice(4);
                    const versionSeparator = alias.lastIndexOf('@');
                    if (versionSeparator > 0) return [`${alias.slice(0, versionSeparator)}@${entry.version}`];
                }
                return [`${descriptor.slice(0, separator)}@${entry.version}`];
            }),
        );
    }
    throw new Error('This lockfile format does not support package exception verification.');
}
