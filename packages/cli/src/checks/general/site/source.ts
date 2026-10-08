import { statSync } from 'node:fs';
import { join, posix } from 'node:path';
import { findingAt } from '#cli/checks/finding.ts';
import { directoryOf } from '#cli/platform/paths.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import type { WebManifest } from '#cli/types/parsers/site.ts';
import { readText, readSource } from '#cli/platform/source.ts';
import { runCheckTool } from '#cli/execution/command/check.ts';
import type { CheckInput } from '#cli/types/execution/check.ts';
import { webManifestSchema } from '#cli/parsers/schema/site.ts';
import { FULL_PERCENTAGE } from '#cli/config/platform/runtime.ts';
import { ASSET_FOLDER, TEXT_SUFFIXES, REQUIRED_HEADERS } from '#cli/config/checks/general/site.ts';

// What svgo says about one file: it cannot read it, it makes it smaller, or nothing.
async function svgFinding(input: CheckInput, path: string): Promise<Finding[]> {
    const original = readSource(input.root, path, input.reads).toString('utf8');
    const result = await runCheckTool(input, ['svgo', '--input', '-', '--output', '-'], {
        cwd: input.root,
        stdin: original,
    });
    if (result.code !== 0) throw new Error(`SVGO could not optimize ${path}: ${result.stderr.trim()}`);
    const originalBytes = Buffer.byteLength(original);
    const saved = originalBytes - Buffer.byteLength(result.stdout);
    const minimum = input.view.options('tools.svgo')['min_saving_percent'];
    const exceeds = saved * FULL_PERCENTAGE > originalBytes * minimum;
    return exceeds
        ? [
              findingAt(
                  input,
                  { file: path, line: 1 },
                  'unoptimized',
                  `svgo makes this file ${String(saved)} bytes smaller.`,
              ),
          ]
        : [];
}

/**
 * The headers a block of the headers file sets for every path.
 * @param text the headers file
 * @returns header names in lower case with their values, from the blocks whose path covers the whole site
 */
function sharedHeaders(text: string): Map<string, string> {
    const held = new Map<string, string>();
    let isSiteWide = false;
    for (const raw of text.split('\n')) {
        const line = raw.trimEnd();
        if (line.trim() === '' || line.trimStart().startsWith('#')) continue;
        if (!/^\s/u.test(line)) isSiteWide = line.trim() === '/*';
        else if (isSiteWide && line.includes(':'))
            held.set(line.slice(0, line.indexOf(':')).trim().toLowerCase(), line.slice(line.indexOf(':') + 1).trim());
    }
    return held;
}
/**
 * Every selected asset that no local text or tracked outside reference names.
 * @param input the check input
 * @returns the findings
 */
export function deadAssets(input: CheckInput): Finding[] {
    const files = input.files;
    const local = new Set(files.map((file) => file.path));
    const paths = new Set([
        ...local,
        ...input.index
            .filter((entry) => entry.stage === 0 && (entry.mode === '100644' || entry.mode === '100755'))
            .map((entry) => entry.path),
    ]);
    const texts = paths
        .values()
        .filter((path) => TEXT_SUFFIXES.has(posix.extname(path)))
        .flatMap((path) => {
            const text = readText(input.root, path, input.reads);
            return text === undefined ? [] : [{ path, text }];
        })
        .toArray();
    return files
        .filter((file) => ASSET_FOLDER.test(file.path) && !TEXT_SUFFIXES.has(posix.extname(file.path)))
        .filter((file) => {
            const name = posix.basename(file.path);
            return texts.every(
                ({ path, text }) =>
                    !text.includes(local.has(path) ? name : posix.relative(directoryOf(path), file.path)),
            );
        })
        .map((file) =>
            findingAt(
                input,
                { file: file.path, line: 1 },
                'dead-asset',
                'No page, stylesheet or script names this file.',
            ),
        );
}

/**
 * SVG reductions above the configured saving percentage, measured in UTF-8 bytes.
 * @param input the check input
 * @returns the findings
 */
export async function svgo(input: CheckInput): Promise<Finding[]> {
    const paths = input.files
        .filter((file) => file.kind === 'source' && file.path.endsWith('.svg'))
        .map((file) => file.path);
    const findings: Finding[] = [];
    for (const path of paths) findings.push(...(await svgFinding(input, path)));
    return findings;
}

/**
 * The web manifest parses, names the app, and every icon it lists exists.
 * @param input the check input
 * @returns the findings
 */
export function webManifest(input: CheckInput): Finding[] {
    const manifests = input.files.filter(
        (file) => file.path.endsWith('.webmanifest') || file.path.endsWith('/manifest.json'),
    );
    return manifests.flatMap((file): Finding[] => {
        const text = readSource(input.root, file.path, input.reads).toString('utf8');
        let parsed: WebManifest;
        try {
            parsed = webManifestSchema.parse(JSON.parse(text));
        } catch (error) {
            return [
                findingAt(
                    input,
                    { file: file.path, line: 1 },
                    'parse',
                    error instanceof Error ? error.message : 'The manifest is not JSON.',
                ),
            ];
        }
        const folder = directoryOf(file.path);
        const unnamed =
            typeof parsed.name === 'string' && parsed.name !== ''
                ? []
                : [findingAt(input, { file: file.path, line: 1 }, 'missing-name', 'The manifest has no name.')];
        const icons = (parsed.icons ?? []).flatMap((icon) => (icon.src === undefined ? [] : [icon.src]));
        const missing = icons
            .filter(
                (src) =>
                    !src.startsWith('http') &&
                    statSync(join(input.root, folder, src.replace(/^\//u, '')), { throwIfNoEntry: false }) ===
                        undefined,
            )
            .map((src) => findingAt(input, { file: file.path, line: 1 }, 'icon', `The icon ${src} does not exist.`));
        return [...unnamed, ...missing];
    });
}

/**
 * The headers file sets the security headers for every path.
 * @param input the check input
 * @returns the findings
 */
export function securityHeaders(input: CheckInput): Finding[] {
    const files = input.files.filter((file) => file.path === '_headers' || file.path.endsWith('/_headers'));
    return files.flatMap((file) => {
        const held = sharedHeaders(readSource(input.root, file.path, input.reads).toString('utf8'));
        const hasFrameRule = /frame-ancestors/iu.test(held.get('content-security-policy') ?? '');
        return Object.entries(REQUIRED_HEADERS)
            .filter(
                ([name, pattern]) =>
                    !pattern.test(held.get(name) ?? '') && !(name === 'x-frame-options' && hasFrameRule),
            )
            .map(([name]) =>
                findingAt(
                    input,
                    { file: file.path, line: 1 },
                    'missing-header',
                    `The block for /* sets no valid ${name} header.`,
                ),
            );
    });
}
