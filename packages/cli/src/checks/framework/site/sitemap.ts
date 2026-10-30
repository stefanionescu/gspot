import { decodeXML } from 'entities';
import { getPosition } from '#cli/system/text.ts';
import { getTable } from '#cli/settings/scopes.ts';
import { readBytes } from '#cli/system/files/reads.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import type { SitemapUrls } from '#cli/types/checks/site.ts';
import type { CheckFinding } from '#cli/types/runs/check.ts';
import { RULES, SITEMAP_FILE, SITEMAP_LOCATION, SITEMAP_EXTENSION } from '#cli/config/checks/framework/site/pages.ts';

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
                file: `${getTable(planned.scope.settings, 'site').build_folder}/${file}`,
                ...getPosition(text, match.index),
                rule: RULES.invalidUrl,
                message: `The sitemap lists ${value}, which is not an absolute URL with valid escapes.`,
            });
        } else {
            urls.push(url);
        }
    }
    return { urls, findings };
}

/**
Read sitemap pages and infer the site base path from its nested sitemap URLs.

@param folder the built site folder.
@param files the built paths.
@param planned the check that selects the sitemap.
@returns URLs, syntax findings, and the base path.
*/
export function readSitemapUrls(
    folder: string,
    files: ReadonlySet<string>,
    planned: PlannedCheck,
): SitemapUrls & { base: string } {
    let base = '/';
    const visited = new Set<string>();
    const urls = new Map<string, URL>();
    const findings: CheckFinding[] = [];
    const readSitemap = (file: string): void => {
        if (visited.has(file)) return;
        visited.add(file);
        const found = readSitemapLocations(folder, file, planned);
        findings.push(...found.findings);
        for (const url of found.urls) {
            if (!url.pathname.endsWith(SITEMAP_EXTENSION)) {
                urls.set(url.href, url);
                continue;
            }
            const pathname = decodeURIComponent(url.pathname);
            const nested = [...files]
                .filter((path) => pathname.endsWith(`/${path}`))
                .toSorted((left, right) => right.length - left.length)[0];
            if (nested === undefined) continue;
            base = base === '/' ? pathname.slice(0, -nested.length) : base;
            readSitemap(nested);
        }
    };
    for (const file of files) if (SITEMAP_FILE.test(file)) readSitemap(file);
    return { urls: urls.values().toArray(), findings, base };
}
