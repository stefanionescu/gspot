// Writes the license notices of the npm packages that the CLI bundle inlines, because their terms travel with each copy.
// The build of the CLI runs it with the bundle's metafile and the file to write.
import { join } from 'node:path';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

type Manifest = {
    name: string;
    version: string;
    license?: string | { type?: string };
    licenses?: Array<{ type?: string }>;
    author?: string | { name?: string };
    repository?: string | { url?: string };
};

const LICENSE_FILE = /^(?:licen[cs]e|copying|notice)(?:[.-]|$)/iu;
const PACKAGE_FOLDER = /^(.*node_modules\/(?:@[^/]+\/)?[^/]+)\//u;

function readLicenseName(manifest: Manifest): string | undefined {
    const { license, licenses } = manifest;
    if (typeof license === 'string') return license;
    return license?.type ?? licenses?.map(({ type }) => type).join(' OR ');
}

function formatCredit({ author, repository }: Manifest): string[] {
    const authorName = typeof author === 'string' ? author : author?.name;
    const address = typeof repository === 'string' ? repository : repository?.url;
    return [`Author: ${authorName ?? 'not named'}`, `Repository: ${address ?? 'not named'}`];
}

function formatNotice(folder: string): [key: string, text: string] {
    const manifest = JSON.parse(readFileSync(join(folder, 'package.json'), 'utf8')) as Manifest;
    const { name, version } = manifest;
    const files = readdirSync(folder).filter((file) => LICENSE_FILE.test(file));
    const license = readLicenseName(manifest);
    if (license === undefined && files.length === 0) throw new Error(`${name} ${version} names no license.`);
    const texts = files.map((file) => readFileSync(join(folder, file), 'utf8').trim());
    const credit = texts.length > 0 ? [] : formatCredit(manifest);
    const heading = [`## ${name} ${version}`, `License: ${license ?? 'see the text below'}`];
    return [`${name}@${version}`, [...heading, ...credit, ...texts].join('\n\n')];
}

function main(): void {
    const [metafilePath, outputPath] = process.argv.slice(2) as [string, string];
    const { inputs } = JSON.parse(readFileSync(metafilePath, 'utf8')) as { inputs: Record<string, unknown> };
    const folders = new Set(Object.keys(inputs).flatMap((input) => PACKAGE_FOLDER.exec(input)?.[1] ?? []));
    const notices = new Map([...folders].map((folder) => formatNotice(folder)));
    const sections = notices
        .keys()
        .toArray()
        .toSorted()
        .map((key) => notices.get(key));
    writeFileSync(outputPath, `# Third-party notices\n\n${sections.join('\n\n')}\n`);
}

main();
