import { decodeXML } from 'entities';

import {
    HTML_EXTENSION,
    INDEX_PAGE,
    SITE_RULES,
    SITEMAP_EXTENSION,
    SITEMAP_FILE,
    SITEMAP_LOCATION,
    UNLISTED_PAGE_MESSAGE,
} from '#cli/config/configurations/site.ts';
import { LEADING_SLASH } from '#cli/config/system.ts';
import { convertToBuildPath, readSuccessfulBuild } from '#cli/configurations/framework/site/checks/build.ts';
import { SITEMAP_EXPLANATIONS } from '#cli/configurations/framework/site/explanations.ts';
import { getTable } from '#cli/settings/scopes.ts';
import { readBytes } from '#cli/system/files/reads.ts';
import { buildPathMatcher } from '#cli/system/patterns.ts';
import { getPosition } from '#cli/system/text/positions.ts';
import type { SitemapUrls } from '#cli/types/configurations/language.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckCode, CheckFinding, CheckSession } from '#cli/types/engine/run.ts';

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

function listPossiblePages(pathname: string): [string, ...string[]] {
    const path = decodeURIComponent(pathname).replace(LEADING_SLASH, '');
    if (path === '' || path.endsWith('/')) return [`${path}${INDEX_PAGE}`];
    return path.endsWith(HTML_EXTENSION) ? [path] : [path, `${path}${HTML_EXTENSION}`, `${path}/${INDEX_PAGE}`];
}

async function checkSitemap(session: CheckSession, planned: PlannedCheck): Promise<CheckFinding[]> {
    const build = await readSuccessfulBuild(session, planned);
    const files = new Set(build.files);
    const sitemapFile = [...files].find((file) => SITEMAP_FILE.test(file));
    if (sitemapFile === undefined) return [];
    const { urls, findings, base } = readSitemapUrls(build.folder, files, planned);
    const entries = urls.map((url) => ({
        url,
        pages: listPossiblePages(url.pathname.startsWith(base) ? url.pathname.slice(base.length) : url.pathname),
    }));
    const listed = new Set(entries.flatMap(({ pages }) => pages));
    const isLeftOut = buildPathMatcher(getTable(planned.scope.settings, 'site').allowed_unlisted_pages);
    const missing = entries
        .filter(({ pages }) => pages.every((page) => !files.has(page)))
        .map(({ url }) => ({
            file: convertToBuildPath(planned, sitemapFile),
            line: 1,
            rule: SITE_RULES.missingPage,
            message: `The sitemap lists ${url.href}, and the build wrote no such page.`,
        }));
    const unlisted = [...files]
        .filter(
            (path) =>
                path.endsWith(HTML_EXTENSION) && !listed.has(path) && !isLeftOut(convertToBuildPath(planned, path)),
        )
        .map((path) => ({
            file: convertToBuildPath(planned, path),
            line: 1,
            rule: SITE_RULES.unlistedPage,
            message: UNLISTED_PAGE_MESSAGE,
        }));
    return [...findings, ...missing, ...unlisted];
}

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

export const SITE_SITEMAP_CHECKS: Readonly<Record<string, CheckCode>> = {
    'site/sitemap': { check: checkSitemap, explanations: SITEMAP_EXPLANATIONS },
};
