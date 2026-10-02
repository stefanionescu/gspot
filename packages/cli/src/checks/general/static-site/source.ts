import { join } from 'node:path';
import { statSync } from 'node:fs';
import { baseName } from '#cli/platform/paths.ts';
import { findingAt } from '#cli/execution/finding.ts';
import { readSource } from '#cli/repository/sources.ts';
import { runCheckCommand } from '#cli/execution/tool/runner.ts';
import type { Finding, EngineInput } from '#cli/types/execution/execution.ts';

import {
    TEXT_SUFFIX,
    ASSET_FOLDER,
    REQUIRED_HEADERS,
    REPORTED_SAVINGS_SHARE,
} from '#cli/config/checks/general/static-site.ts';
// What svgo says about one file: it cannot read it, it makes it smaller, or nothing.
async function svgFinding(input: EngineInput, path: string): Promise<Finding[]> {
    const original = readSource(input.root, path, input.reads).toString('utf8');
    const result = await runCheckCommand(input, ['svgo', '--input', '-', '--output', '-'], {
        cwd: input.root,
        stdin: original,
    });
    if (result.code !== 0) throw new Error(`SVGO could not optimize ${path}: ${result.stderr.trim()}`);
    const originalBytes = Buffer.byteLength(original);
    const saved = originalBytes - Buffer.byteLength(result.stdout);
    const exceeds =
        input.policyFiles.policy.level === 'all' ? saved > 0 : saved * REPORTED_SAVINGS_SHARE > originalBytes;
    return exceeds
        ? [findingAt(input, { file: path, line: 1 }, 'svg', `svgo makes this file ${String(saved)} bytes smaller.`)]
        : [];
}

/**
 * The headers a block of the headers file sets for every path.
 * @param text the headers file
 * @returns header names in lower case with their values, from the blocks whose path covers the whole site
 */
function siteWideHeaders(text: string): Map<string, string> {
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
 * Every tracked file under an assets folder that no text file of the site names.
 * @param input the engine input
 * @returns the findings
 */
export function deadAssets(input: EngineInput): Finding[] {
    const files = input.files;
    const texts = files
        .filter((file) => TEXT_SUFFIX.test(file.path))
        .map((file) => readSource(input.root, file.path, input.reads).toString('utf8'));
    return files
        .filter((file) => ASSET_FOLDER.test(file.path) && !TEXT_SUFFIX.test(file.path))
        .filter((file) => {
            const name = baseName(file.path);
            return texts.every((text) => !text.includes(name));
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
 * SVG reductions above the selected level threshold, measured in UTF-8 bytes.
 * @param input the engine input
 * @returns the findings
 */
export async function svgCompressed(input: EngineInput): Promise<Finding[]> {
    const paths = input.files
        .filter((file) => file.kind === 'source' && file.path.endsWith('.svg'))
        .map((file) => file.path);
    const findings: Finding[] = [];
    for (const path of paths) findings.push(...(await svgFinding(input, path)));
    return findings;
}

/**
 * The web manifest parses, names the app, and every icon it lists exists.
 * @param input the engine input
 * @returns the findings
 */
export function webManifest(input: EngineInput): Finding[] {
    const manifests = input.files.filter(
        (file) => file.path.endsWith('.webmanifest') || file.path.endsWith('/manifest.json'),
    );
    return manifests.flatMap((file): Finding[] => {
        const text = readSource(input.root, file.path, input.reads).toString('utf8');
        let parsed: { name?: unknown; icons?: { src?: string }[] };
        try {
            parsed = JSON.parse(text) as typeof parsed;
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
        const folder = file.path.includes('/') ? file.path.slice(0, file.path.lastIndexOf('/')) : '';
        const unnamed =
            typeof parsed.name === 'string' && parsed.name !== ''
                ? []
                : [findingAt(input, { file: file.path, line: 1 }, 'name', 'The manifest has no name.')];
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
 * @param input the engine input
 * @returns the findings
 */
export function securityHeaders(input: EngineInput): Finding[] {
    const files = input.files.filter((file) => file.path === '_headers' || file.path.endsWith('/_headers'));
    return files.flatMap((file) => {
        const held = siteWideHeaders(readSource(input.root, file.path, input.reads).toString('utf8'));
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
