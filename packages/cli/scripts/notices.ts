import { z } from 'zod';
import { fileURLToPath } from 'node:url';
import { prepareInput } from './inputs.ts';
import { SWIFT_GRAMMAR } from '#cli/types/platform.ts';
import { dirname, join, resolve, sep } from 'node:path';
import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs';

const packageSchema = z.object({
    name: z.string(),
    version: z.string(),
    license: z.union([z.string(), z.object({ type: z.string() }).transform((license) => license.type)]),
});
type UpstreamNotice = { source: string; sha256: string; attribution?: string; omitTemplateCopyright?: boolean };

const UPSTREAM_NOTICES: Record<string, UpstreamNotice> = {
    '@bomb.sh/tab@0.0.22': {
        source: 'https://raw.githubusercontent.com/spdx/license-list-data/v3.27.0/text/MIT.txt',
        sha256: 'b05785f9f18e6716bab63424b11454513b9943a222595b70411009202fc592b5',
        attribution:
            'Author recorded by @bomb.sh/tab 0.0.22: Bombshell Authors (https://github.com/bombshell-dev). The package declares MIT and distributes no separate license notice.',
        omitTemplateCopyright: true,
    },
    '@yarnpkg/parsers@3.1.0': {
        source: 'https://raw.githubusercontent.com/yarnpkg/berry/923f69827c77fe5cf4f6c28c0cab3c02a256abf0/LICENSE.md',
        sha256: '238d933f5c226cc197bd1dae2ad0c468e157b4cba8ed844f81549ba6db777dc4',
    },
    '@manypkg/tools@2.1.2': {
        source: 'https://raw.githubusercontent.com/Thinkmill/manypkg/97e2ab9bc64e45af099f63f25c515f3792738cfb/LICENSE',
        sha256: '3ec022e93fe45084cb405775906f5bf332b58f6f422ea437811eb376f7fbf5a8',
    },
    '@pnpm/network.ca-file@1.0.2': {
        source: 'https://raw.githubusercontent.com/pnpm/components/a9b32aa67fd657cdea94fedf0b68f7953b8d1f85/LICENSE',
        sha256: '127161487fae720d42adf2bbb7e5e047174fc443050e799c3fb2cad407d721ab',
    },
    '@pnpm/config.env-replace@1.1.0': {
        source: 'https://raw.githubusercontent.com/pnpm/components/a9b32aa67fd657cdea94fedf0b68f7953b8d1f85/LICENSE',
        sha256: '127161487fae720d42adf2bbb7e5e047174fc443050e799c3fb2cad407d721ab',
    },
    'spdx-license-ids@3.0.23': {
        source: 'https://raw.githubusercontent.com/spdx/license-list-data/v3.27.0/text/CC0-1.0.txt',
        sha256: 'a2010f343487d3f7618affe54f789f5487602331c0a8d03f49e9a7c547cf0499',
    },
    'spdx-exceptions@2.5.0': {
        source: 'https://raw.githubusercontent.com/spdx/license-list-data/v3.27.0/text/CC-BY-3.0.txt',
        sha256: 'e6bc9e9c474700b708f568bac9e5a8a9bcb2b1dad53442f5ba449fcb848b8e76',
        attribution:
            'Copyright © 2010-2015 Linux Foundation and its Contributors. Licensed under the Creative Commons Attribution License 3.0 Unported. All other rights are expressly reserved. Source: spdx-exceptions 2.5.0 README.md.',
    },
    'bun@1.4.2': {
        source: 'https://raw.githubusercontent.com/oven-sh/bun/bun-v1.4.2/LICENSE.md',
        sha256: 'b9caf52728691b4057e371232c221a132883198be2f3d2ddf92c90404c984b1a',
    },
    'tree-sitter-swift@0.7.3': {
        source: 'https://raw.githubusercontent.com/alex-pinkus/tree-sitter-swift/b8b22bffbb3441780e6471665bacfb263741c86a/LICENSE',
        sha256: '3533cec129bb4bba015c0d61d86dd7c3b7e82110e4d2ff7837a01eff5bad5ccc',
    },
};
const MINIMUM_FENCE_LENGTH = 3;
const LICENSE = /^(?:LICEN[CS]E|COPYING|NOTICE)(?:$|[.-])/iu;

function licenseBlock(title: string, bytes: string): string {
    const fence = '~'.repeat(
        Math.max(MINIMUM_FENCE_LENGTH, ...[...bytes.matchAll(/~+/gu)].map((match) => match[0].length + 1)),
    );
    return `### ${title}\n\n${fence}text\n${bytes.trimEnd()}\n${fence}\n`;
}

/**
 * Identify the installed package owning a bundled input, including nested dependencies.
 * @param file bundled input path
 * @returns the installed package directory
 */
function bundledPackage(file: string): string {
    let directory = dirname(realpathSync(file));
    while (directory.includes(`${sep}node_modules${sep}`)) {
        const path = join(directory, 'package.json');
        if (existsSync(path) && packageSchema.safeParse(JSON.parse(readFileSync(path, 'utf8'))).success)
            return directory;
        directory = dirname(directory);
    }
    throw new Error(`Cannot identify the bundled package for ${file}.`);
}

/**
 * Preserve pinned upstream terms when an installed package omits its license material.
 * @param identity package name and exact version
 * @returns the recorded upstream license text and provenance
 */
async function upstreamNotice(identity: string): Promise<string> {
    const record = UPSTREAM_NOTICES[identity];
    if (record === undefined) throw new Error(`No license notice is recorded for bundled ${identity}.`);
    const path = fileURLToPath(new URL(`../.build/notices/${record.sha256}.txt`, import.meta.url));
    let text = Buffer.from(await prepareInput(path, { url: record.source, sha256: record.sha256 })).toString('utf8');
    if (record.omitTemplateCopyright === true) text = text.replace('Copyright (c) <year> <copyright holders>\n\n', '');
    const attribution = record.attribution === undefined ? '' : `\n${record.attribution}\n`;
    return `\nLicense source: ${record.source}\n${attribution}\n${licenseBlock('License terms', text)}`;
}

async function packageNotices(directory: string, identity: string): Promise<string> {
    const files = readdirSync(directory, { withFileTypes: true })
        .filter((entry) => entry.isFile() && LICENSE.test(entry.name))
        .map((entry) => entry.name)
        .toSorted((left, right) => left.localeCompare(right));
    return files.length === 0
        ? upstreamNotice(identity)
        : files.map((file) => `\n${licenseBlock(file, readFileSync(join(directory, file), 'utf8'))}`).join('');
}

/**
 * Collects legal notices from the exact bundled inputs and their installed packages.
 * @param metadata bundler metadata and their input working directories
 * @param additionalFiles embedded dependency assets outside the module graph
 * @returns dependency notices ordered by package identity
 */
export async function dependencyNotices(
    metadata: { inputs: Record<string, unknown>; cwd: string }[],
    additionalFiles: string[],
): Promise<string> {
    const files = [...additionalFiles];
    for (const entry of metadata) {
        files.push(...Object.keys(entry.inputs).map((path) => resolve(entry.cwd, path)));
    }
    const directories = new Set(
        files.filter((file) => file.includes(`${sep}node_modules${sep}`)).map((file) => bundledPackage(file)),
    );
    const notices = new Map<string, string>();
    for (const directory of directories) {
        const manifest = packageSchema.parse(JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8')));
        const identity = `${manifest.name}@${manifest.version}`;
        const content = `## ${identity}\n\nDeclared license: ${manifest.license}.\n${await packageNotices(directory, identity)}`;
        const previous = notices.get(identity);
        if (previous !== undefined && previous !== content)
            throw new Error(`Conflicting license notices for ${identity}.`);
        notices.set(identity, content);
    }
    return [...notices]
        .toSorted(([left], [right]) => left.localeCompare(right))
        .map(([, text]) => text)
        .join('\n');
}

/**
 * Adds runtime and grammar attribution to the bundled dependency notices.
 * @param dependencies the notices of the bundled dependencies
 * @returns the complete notices text
 */
export async function binaryNotices(dependencies: string): Promise<string> {
    const runtime = UPSTREAM_NOTICES[`bun@${Bun.version}`];
    if (runtime === undefined) throw new Error(`No runtime notice is recorded for Bun ${Bun.version}.`);
    const grammarNotice = await upstreamNotice(`tree-sitter-swift@${SWIFT_GRAMMAR.version}`);
    const runtimeNotice = await upstreamNotice(`bun@${Bun.version}`);
    return `# Third-party notices\n\nGenerated by bun packages/cli/scripts/command.ts from bundled dependency licenses and pinned upstream records.\n\n${dependencies}\n## tree-sitter-swift ${SWIFT_GRAMMAR.version}\n\nSource: ${SWIFT_GRAMMAR.url}\n\nSHA-256: ${SWIFT_GRAMMAR.sha256}\n${grammarNotice}\n## Bun ${Bun.version}\n\nSource: ${runtime.source}\n\n${runtimeNotice}`;
}
