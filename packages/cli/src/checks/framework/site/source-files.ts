import { z } from 'zod';
import { statSync } from 'node:fs';
import { join, posix } from 'node:path';
import { decodeHTMLAttribute } from 'entities';
import { findingAt } from '#cli/checks/finding.ts';
import { directoryOf } from '#cli/system/paths.ts';
import { FULL_PERCENTAGE } from '#cli/config/units.ts';
import { elementAttributes } from '#cli/parsers/html.ts';
import type { SchemaShape } from '#cli/types/objects.ts';
import { runCheckTool } from '#cli/execution/command/tool.ts';
import { visitParsedSources } from '#cli/parsers/tree-sitter.ts';
import { readText, readSource } from '#cli/system/file-reads.ts';
import { type WebManifest } from '#cli/types/checks/framework.ts';
import { FILENAME_TAGS } from '#cli/config/repository/inventory.ts';
import { type Finding, type CheckInput } from '#cli/types/execution/check.ts';

import {
    HTML_FILE,
    ASSET_FOLDER,
    SVGO_COMMAND,
    MANIFEST_REL,
    TEXT_SUFFIXES,
    SVG_EXTENSION,
    GIT_FILE_MODES,
    PLACEHOLDER_ORIGIN,
    WEB_MANIFEST_EXTENSION,
} from '#cli/config/checks/framework/site.ts';

// What svgo says about one file: it cannot read it, it makes it smaller, or nothing.
async function svgFinding(input: CheckInput, path: string): Promise<Finding[]> {
    const original = readSource(input.root, path, input.reads).toString('utf8');
    const result = await runCheckTool(input, [...SVGO_COMMAND], {
        cwd: input.root,
        stdin: original,
    });
    if (result.code !== 0) throw new Error(`SVGO could not optimize ${path}: ${result.stderr.trim()}`);
    const originalBytes = Buffer.byteLength(original);
    const saved = originalBytes - Buffer.byteLength(result.stdout);
    const minimum = input.selection.view.options('tools.svgo')['min_saving_percent'];
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

/** Web manifest fields for checking the application name and local icon paths. */
const webManifestSchema = z.object({
    name: z.unknown().optional(),
    icons: z
        .array(
            z.object({ src: z.string().optional() } satisfies SchemaShape<NonNullable<WebManifest['icons']>[number]>),
        )
        .optional(),
} satisfies SchemaShape<WebManifest>);

/**
 * Every selected asset that no local text or tracked outside reference names.
 * @param input the check input.
 * @returns the findings.
 */
export function unusedAssets(input: CheckInput): Finding[] {
    const files = input.files;
    const local = new Set(files.map((file) => file.path));
    const paths = new Set([
        ...local,
        ...input.index
            .filter((entry) => entry.stage === 0 && new Set<string | undefined>(GIT_FILE_MODES).has(entry.mode))
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
        .filter(
            (file) =>
                ASSET_FOLDER.test(file.path) &&
                !Object.hasOwn(FILENAME_TAGS, posix.basename(file.path)) &&
                !TEXT_SUFFIXES.has(posix.extname(file.path)),
        )
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
 * @param input the check input.
 * @returns the findings.
 */
export async function svgo(input: CheckInput): Promise<Finding[]> {
    const paths = input.files
        .filter((file) => file.kind === 'source' && file.path.endsWith(SVG_EXTENSION))
        .map((file) => file.path);
    const findings: Finding[] = [];
    for (const path of paths) findings.push(...(await svgFinding(input, path)));
    return findings;
}

/**
 * The web manifest parses, names the app, and every icon it lists exists.
 * @param input the check input.
 * @returns the findings.
 */
export async function webManifest(input: CheckInput): Promise<Finding[]> {
    const targets = new Set(
        input.files.filter((file) => file.path.endsWith(WEB_MANIFEST_EXTENSION)).map((file) => file.path),
    );
    const files = input.files
        .filter((file) => HTML_FILE.test(file.path))
        .map((file) => ({ path: file.path, grammar: 'html' as const }));
    await visitParsedSources({ ...input, files }, (source) => {
        for (const element of source.rootNode.descendantsOfType('element')) {
            const attributes = elementAttributes(element);
            const rel = attributes.find((attribute) => attribute.element === 'link' && attribute.name === 'rel');
            if (rel?.value.toLowerCase().split(/\s+/u).includes(MANIFEST_REL) !== true) continue;
            const href = attributes.find((attribute) => attribute.name === 'href');
            if (href === undefined) continue;
            const origin = new URL(source.path, PLACEHOLDER_ORIGIN);
            const target = URL.parse(decodeHTMLAttribute(href.value), origin.href);
            if (target?.origin === origin.origin) targets.add(decodeURIComponent(target.pathname).slice(1));
        }
    });
    const manifests = input.files.filter((file) => targets.has(file.path));
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
