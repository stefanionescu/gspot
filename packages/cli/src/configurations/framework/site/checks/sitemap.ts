import { decodeXML } from 'entities';
import { getPosition } from '#cli/system/text.ts';
import { readBytes } from '#cli/system/files/reads.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckFinding } from '#cli/types/engine/tool-runs.ts';
import type { SitemapUrls } from '#cli/types/configurations/language.ts';
import { convertToBuildPath } from '#cli/configurations/framework/site/checks/build.ts';
import { SITE_RULES, SITEMAP_FILE, SITEMAP_LOCATION, SITEMAP_EXTENSION } from '#cli/config/configurations/framework.ts';

function parseSitemapUrl(value: string): URL | undefined {
    const url = URL.parse(value);
    if (url === null) return undefined;
    try {
        decodeURIComponent(url.pathname);
        return url;
    } catch (error) {
        if (error instanceof URIError) return undefined;
        throw error;
    }
}

function readSitemapLocations(folder: string, file: string, planned: PlannedCheck): SitemapUrls {
    const urls: URL[] = [];
    const findings: CheckFinding[] = [];
    const text = readBytes(folder, file).toString('utf8');
    for (const match of text.matchAll(SITEMAP_LOCATION)) {
        const value = decodeXML(match.groups?.['cdata'] ?? match.groups?.['url'] ?? '').trim();
        const url = parseSitemapUrl(value);
        if (url === undefined) {
            findings.push({
                file: convertToBuildPath(planned, file),
                ...getPosition(text, match.index),
                rule: SITE_RULES.invalidUrl,
                message: `The sitemap lists ${value}, which is not an absolute URL with valid escapes.`,
            });
        } else {
            urls.push(url);
        }
    }
    return { urls, findings };
}

function readSitemapTree(
    file: string,
    tree: {
        folder: string;
        files: ReadonlySet<string>;
        planned: PlannedCheck;
        visited: Set<string>;
        urls: Map<string, URL>;
        findings: CheckFinding[];
        base: string;
    },
): void {
    if (tree.visited.has(file)) return;
    tree.visited.add(file);
    const found = readSitemapLocations(tree.folder, file, tree.planned);
    tree.findings.push(...found.findings);
    for (const url of found.urls) {
        if (!url.pathname.endsWith(SITEMAP_EXTENSION)) {
            tree.urls.set(url.href, url);
            continue;
        }
        const pathname = decodeURIComponent(url.pathname);
        const nested = [...tree.files]
            .filter((path) => pathname.endsWith(`/${path}`))
            .toSorted((left, right) => right.length - left.length)[0];
        if (nested === undefined) continue;
        if (tree.base === '/') tree.base = pathname.slice(0, -nested.length);
        readSitemapTree(nested, tree);
    }
}

/**
Read sitemap pages and infer the site base path from its nested sitemap URLs.

@param folder the built site folder.
@param files the built paths.
@param planned the check that selects the sitemap.
*/
export function readSitemapUrls(
    folder: string,
    files: ReadonlySet<string>,
    planned: PlannedCheck,
): SitemapUrls & { base: string } {
    const findings: CheckFinding[] = [];
    const tree = {
        folder,
        files,
        planned,
        visited: new Set<string>(),
        urls: new Map<string, URL>(),
        findings,
        base: '/',
    };
    for (const file of files) if (SITEMAP_FILE.test(file)) readSitemapTree(file, tree);
    return { urls: tree.urls.values().toArray(), findings, base: tree.base };
}
