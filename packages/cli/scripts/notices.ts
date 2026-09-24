import { z } from 'zod';
import { dirname, join, resolve, sep } from 'node:path';
import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs';

const packageSchema = z.object({
    name: z.string(),
    version: z.string(),
    license: z.union([z.string(), z.object({ type: z.string() }).transform((license) => license.type)]),
});
const recordSchema = z.object({
    license: z.string(),
    source: z.url(),
    attribution: z.string().optional(),
    omitTemplateCopyright: z.boolean().optional(),
});
const upstream = z
    .object({ licenses: z.record(z.string(), z.string()), packages: z.record(z.string(), recordSchema) })
    .refine(
        ({ licenses, packages }) => Object.values(packages).every((record) => record.license in licenses),
        'Every package notice needs its license text.',
    )
    .parse(JSON.parse(readFileSync(new URL('./notices.json', import.meta.url), 'utf8')));
const metadataSchema = z.object({ inputs: z.record(z.string(), z.unknown()) });
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
function upstreamNotice(identity: string): string {
    const record = upstream.packages[identity];
    if (record === undefined) throw new Error(`No license notice is recorded for bundled ${identity}.`);
    let text = upstream.licenses[record.license]!;
    if (record.omitTemplateCopyright === true) text = text.replace('Copyright (c) <year> <copyright holders>\n\n', '');
    const attribution = record.attribution === undefined ? '' : `\n${record.attribution}\n`;
    return `\nLicense source: ${record.source}\n${attribution}\n${licenseBlock('License terms', text)}`;
}

function packageNotices(directory: string, identity: string): string {
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
 * @param metadata bundler metadata paths and their input working directories
 * @param additionalFiles embedded dependency assets outside the module graph
 * @returns dependency notices ordered by package identity
 */
export function dependencyNotices(metadata: { path: string; cwd: string }[], additionalFiles: string[]): string {
    const files = [...additionalFiles];
    for (const entry of metadata) {
        const parsed = metadataSchema.parse(JSON.parse(readFileSync(entry.path, 'utf8')));
        files.push(...Object.keys(parsed.inputs).map((path) => resolve(entry.cwd, path)));
    }
    const directories = new Set(
        files.filter((file) => file.includes(`${sep}node_modules${sep}`)).map((file) => bundledPackage(file)),
    );
    const notices = new Map<string, string>();
    for (const directory of directories) {
        const manifest = packageSchema.parse(JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8')));
        const identity = `${manifest.name}@${manifest.version}`;
        const content = `## ${identity}\n\nDeclared license: ${manifest.license}.\n${packageNotices(directory, identity)}`;
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
 * Adds the compiled runtime and vendored grammar provenance to a binary distribution.
 * @param dependencies assembled bundled dependency notices
 * @param grammarDirectory embedded grammar files and provenance
 * @returns complete binary distribution notices
 */
export function binaryNotices(dependencies: string, grammarDirectory: string): string {
    const provenance = z
        .object({
            source: z.url(),
            revision: z.string().regex(/^[a-f0-9]{40}$/u),
            version: z.string(),
            sha256: z.string().regex(/^[a-f0-9]{64}$/u),
        })
        .parse(JSON.parse(readFileSync(join(grammarDirectory, 'swift.json'), 'utf8')));
    const digest = new Bun.CryptoHasher('sha256')
        .update(readFileSync(join(grammarDirectory, 'swift.wasm')))
        .digest('hex');
    if (digest !== provenance.sha256)
        throw new Error(
            'The Swift grammar does not match its provenance. Run bun packages/cli/scripts/build-swift-grammar.ts.',
        );
    const runtime = upstream.packages[`bun@${Bun.version}`];
    if (runtime === undefined) throw new Error(`No runtime notice is recorded for Bun ${Bun.version}.`);
    return `# Third-party notices\n\nGenerated by bun packages/cli/scripts/build.ts from bundled dependency licenses and pinned upstream records.\n\n${dependencies}\n## tree-sitter-swift ${provenance.version}\n\nSource: ${provenance.source}\n\nRevision: ${provenance.revision}\n\nSHA-256: ${provenance.sha256}\n\n${licenseBlock('Swift grammar license', readFileSync(join(grammarDirectory, 'swift.LICENSE'), 'utf8'))}\n## Bun ${Bun.version}\n\nSource: ${runtime.source}\n\n${upstream.licenses[runtime.license]!}`;
}
