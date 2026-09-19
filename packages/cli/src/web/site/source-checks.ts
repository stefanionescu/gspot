// The checks that read the source of a static site: assets nobody references, images that still compress, the manifest, and the headers file.
import { join } from 'node:path';
import { run } from '#cli/platform/spawn.ts';
import type { EngineInput } from '#types/run.ts';
import type { Finding } from '#types/finding.ts';
import { existsSync, readFileSync } from 'node:fs';
import { locateTool } from '#cli/platform/tool-probe.ts';
import { MissingToolError } from '#cli/platform/missing-tool.ts';

const TEXT_SUFFIX = /\.(?:html?|css|scss|m?js|ts|json|webmanifest|xml|txt|md|toml|ya?ml)$/u;
const ASSET_FOLDER = /(?:^|\/)assets\//u;
const SVG_TIMEOUT_MS = 120_000;
const REQUIRED_HEADERS: Record<string, RegExp> = {
    'x-content-type-options': /^nosniff$/iu,
    'referrer-policy': /\S/u,
    'x-frame-options': /^(?:deny|sameorigin)$/iu,
};

function finding(input: EngineInput, file: string, rule: string, text: string, line = 1): Finding {
    return { check: input.spec.id, file, line, rule, message: text, fixable: false };
}

function sources(input: EngineInput): { path: string; nature: string }[] {
    return input.session.repository.files.filter(
        (file) => input.scope === '' || file.path.startsWith(`${input.scope}/`),
    );
}

// What svgo says about one file: it cannot read it, it makes it smaller, or nothing.
async function svgFinding(input: EngineInput, binary: string, path: string): Promise<Finding[]> {
    const original = readFileSync(join(input.root, path), 'utf8');
    const result = await run([binary, '--input', join(input.root, path), '--output', '-'], {
        cwd: input.root,
        timeoutMs: SVG_TIMEOUT_MS,
    });
    if (result.code !== 0)
        return [
            finding(input, path, 'svg', `svgo cannot read this file: ${result.stderr.trim().split('\n', 1)[0] ?? ''}`),
        ];
    const saved = original.trim().length - result.stdout.trim().length;
    return saved > 0 ? [finding(input, path, 'svg', `svgo makes this file ${String(saved)} bytes smaller.`)] : [];
}

/**
 * Every tracked file under an assets folder that no text file of the site names.
 * @param input the engine input
 * @returns the findings
 */
export function deadAssets(input: EngineInput): Promise<Finding[]> {
    const files = sources(input);
    const texts = files
        .filter((file) => TEXT_SUFFIX.test(file.path))
        .map((file) => readFileSync(join(input.root, file.path), 'utf8'));
    const found = files
        .filter((file) => ASSET_FOLDER.test(file.path) && !TEXT_SUFFIX.test(file.path))
        .filter((file) => {
            const name = file.path.slice(file.path.lastIndexOf('/') + 1);
            return texts.every((text) => !text.includes(name));
        })
        .map((file) => finding(input, file.path, 'dead-asset', 'No page, stylesheet or script names this file.'));
    return Promise.resolve(found);
}

/**
 * Every SVG that svgo still makes smaller.
 * @param input the engine input
 * @returns the findings
 */
export async function svgCompressed(input: EngineInput): Promise<Finding[]> {
    const binary = locateTool(input.root, 'svgo');
    if (binary === undefined) throw new MissingToolError('The svgo command is not installed.');
    const paths = input.files
        .filter((file) => file.nature === 'source' && file.path.endsWith('.svg'))
        .map((file) => file.path);
    const findings: Finding[] = [];
    for (const path of paths) findings.push(...(await svgFinding(input, binary, path)));
    return findings;
}

/**
 * The web manifest parses, names the app, and every icon it lists exists.
 * @param input the engine input
 * @returns the findings
 */
export function webManifest(input: EngineInput): Promise<Finding[]> {
    const manifests = sources(input).filter(
        (file) => file.path.endsWith('.webmanifest') || file.path.endsWith('/manifest.json'),
    );
    const found = manifests.flatMap((file): Finding[] => {
        let parsed: { name?: unknown; icons?: { src?: string }[] };
        try {
            parsed = JSON.parse(readFileSync(join(input.root, file.path), 'utf8')) as typeof parsed;
        } catch (error) {
            return [
                finding(
                    input,
                    file.path,
                    'parse',
                    error instanceof Error ? error.message : 'The manifest is not JSON.',
                ),
            ];
        }
        const folder = file.path.includes('/') ? file.path.slice(0, file.path.lastIndexOf('/')) : '';
        const unnamed =
            typeof parsed.name === 'string' && parsed.name !== ''
                ? []
                : [finding(input, file.path, 'name', 'The manifest has no name.')];
        const icons = (parsed.icons ?? []).flatMap((icon) => (icon.src === undefined ? [] : [icon.src]));
        const missing = icons
            .filter((src) => !src.startsWith('http') && !existsSync(join(input.root, folder, src.replace(/^\//u, ''))))
            .map((src) => finding(input, file.path, 'icon', `The icon ${src} does not exist.`));
        return [...unnamed, ...missing];
    });
    return Promise.resolve(found);
}

/**
 * The headers a block of the headers file sets for every path.
 * @param text the headers file
 * @returns header names in lower case with their values, from the blocks whose path covers the whole site
 */
export function siteWideHeaders(text: string): Map<string, string> {
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
 * The headers file sets the security headers for every path.
 * @param input the engine input
 * @returns the findings
 */
export function securityHeaders(input: EngineInput): Promise<Finding[]> {
    const files = sources(input).filter((file) => file.path === '_headers' || file.path.endsWith('/_headers'));
    const found = files.flatMap((file) => {
        const held = siteWideHeaders(readFileSync(join(input.root, file.path), 'utf8'));
        const hasFrameRule = /frame-ancestors/iu.test(held.get('content-security-policy') ?? '');
        return Object.entries(REQUIRED_HEADERS)
            .filter(
                ([name, pattern]) =>
                    !pattern.test(held.get(name) ?? '') && !(name === 'x-frame-options' && hasFrameRule),
            )
            .map(([name]) =>
                finding(input, file.path, 'missing-header', `The block for /* sets no valid ${name} header.`),
            );
    });
    return Promise.resolve(found);
}
