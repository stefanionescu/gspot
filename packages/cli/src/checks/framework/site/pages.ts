import { gzipSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';
import { getPosition } from '#cli/system/text.ts';
import { getTable } from '#cli/settings/scopes.ts';
import { buildFinding } from '#cli/checks/finding.ts';
import { readBytes } from '#cli/system/files/reads.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import { runCheckTool } from '#cli/runs/command/tool.ts';
import { BYTES_PER_KILOBYTE } from '#cli/config/units.ts';
import { parseOutput } from '#cli/runs/output/formats.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import type { CheckSession } from '#cli/types/session.ts';
import { buildPathMatcher } from '#cli/system/matchers.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { SETTINGS_FILE } from '#cli/config/settings/file.ts';
import { parseToolReport } from '#cli/parsers/formats/json.ts';
import { assertToolFindings } from '#cli/runs/command/output.ts';
import { splitFileArguments } from '#cli/runs/command/batches.ts';
import { createTemporaryFolder } from '#cli/system/files/folders.ts';
import { getConfigFilePath } from '#cli/runs/command/placeholders.ts';
import type { SitemapUrls } from '#cli/types/checks/framework/site.ts';
import { join, extname, relative, normalize, isAbsolute } from 'node:path';
import { purgecssReportSchema } from '#cli/schemas/checks/framework/site.ts';
import { PURGECSS_TOOL } from '#cli/config/checks/framework/site/purgecss-process.ts';
import { listBuiltFiles, readSuccessfulBuild } from '#cli/checks/framework/site/build.ts';

import {
    INDEX_PAGE,
    LYCHEE_TOOL,
    SITEMAP_FILE,
    CSS_EXTENSION,
    HTML_EXTENSION,
    PURGECSS_CONTENT,
    PURGECSS_PROCESS,
    HTML_REPORT_FILE,
    LYCHEE_ARGUMENTS,
    SITEMAP_LOCATION,
    SITEMAP_EXTENSION,
    HTML_VALIDATE_TOOL,
    HTML_VALIDATE_CONFIG_FLAG,
    HTML_VALIDATE_FORMATTER_FLAG,
} from '#cli/config/checks/framework/site/pages.ts';

// eslint-disable-next-line gspot/no-trivial-functions -- reason: 8 calls in this file share it.
function joinBuildFolder(planned: Pick<PlannedCheck, 'scope'>, path: string): string {
    return `${getTable(planned.scope.settings, 'site')['build_folder']}/${convertToPosixPath(normalize(path))}`;
}

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
    const findings: Finding[] = [];
    const text = readBytes(folder, file).toString('utf8');
    for (const match of text.matchAll(SITEMAP_LOCATION)) {
        const value = match.groups?.['url'] ?? '';
        const url = parseSitemapUrl(value);
        if (url === undefined) {
            findings.push(
                buildFinding(
                    planned,
                    { file: joinBuildFolder(planned, file), ...getPosition(text, match.index) },
                    'invalid-url',
                    `The sitemap lists ${value}, which is not an absolute URL with valid escapes.`,
                ),
            );
        } else {
            urls.push(url);
        }
    }
    return { urls, findings };
}

function readSitemapUrls(folder: string, files: ReadonlySet<string>, planned: PlannedCheck): SitemapUrls {
    const visited = new Set<string>();
    const urls = new Map<string, URL>();
    const findings: Finding[] = [];
    const read = (file: string): void => {
        if (visited.has(file)) return;
        visited.add(file);
        const found = readSitemapLocations(folder, file, planned);
        findings.push(...found.findings);
        for (const url of found.urls) {
            if (url.pathname.endsWith(SITEMAP_EXTENSION)) {
                const nested = decodeURIComponent(url.pathname).replace(/^\//u, '');
                if (files.has(nested)) read(nested);
            } else urls.set(url.href, url);
        }
    };
    for (const file of files) if (SITEMAP_FILE.test(file)) read(file);
    return { urls: urls.values().toArray(), findings };
}

function listPossiblePages(pathname: string): [string, ...string[]] {
    const path = decodeURIComponent(pathname).replace(/^\//u, '');
    if (path === '' || path.endsWith('/')) return [`${path}${INDEX_PAGE}`];
    return path.endsWith(HTML_EXTENSION) ? [path] : [path, `${path}${HTML_EXTENSION}`, `${path}/${INDEX_PAGE}`];
}

/**
Reports broken links between built pages, stylesheets, and fragments.

@param session the repository and its tools.
@param planned the scope whose site to check.
@returns one finding for each broken link.
*/
export async function checkSiteLychee(session: CheckSession, planned: PlannedCheck): Promise<Finding[]> {
    const build = await readSuccessfulBuild(session, planned);
    const pages = new Set(listBuiltFiles(build.folder));
    const location = readSitemapUrls(build.folder, pages, planned).urls[0];
    const paths = [...pages].filter((path) => path.endsWith(HTML_EXTENSION));
    if (paths.length === 0) return [];
    const command = [
        LYCHEE_TOOL,
        ...LYCHEE_ARGUMENTS,
        '--root-dir',
        build.folder,
        ...(location === undefined
            ? []
            : ['--remap', `^${RegExp.escape(location.origin)}/ ${pathToFileURL(build.folder).href}/`]),
        ...getTable(planned.scope.settings, 'docs').allowed_urls.flatMap((value) => ['--exclude', value]),
    ];
    const findings: Finding[] = [];
    for (const batch of splitFileArguments(paths, command, process.platform)) {
        const result = await runCheckTool(session, planned, [...command, ...batch], { cwd: build.folder });
        const parsed = assertToolFindings(
            result,
            parseOutput(planned.check, result.stdout, result.stderr, { root: build.folder, cwd: build.folder }),
            LYCHEE_TOOL,
        );
        findings.push(...parsed.map((finding) => ({ ...finding, file: joinBuildFolder(planned, finding.file) })));
    }
    return findings;
}

/**
Runs html-validate on every built page with the config file for built output.

@param session the repository and its tools.
@param planned the scope whose site to check.
@returns the findings.
*/
export async function checkSiteHtmlValidate(session: CheckSession, planned: PlannedCheck): Promise<Finding[]> {
    const build = await readSuccessfulBuild(session, planned);
    const pages = listBuiltFiles(build.folder)
        .filter((path) => path.endsWith(HTML_EXTENSION))
        .map((path) => join(build.folder, path));
    if (pages.length === 0) return [];
    const configFile = join(session.root, getConfigFilePath(session, planned, HTML_VALIDATE_TOOL));
    using reports = createTemporaryFolder();
    const command = [
        HTML_VALIDATE_TOOL,
        HTML_VALIDATE_CONFIG_FLAG,
        configFile,
        HTML_VALIDATE_FORMATTER_FLAG,
        `json=${join(reports.path, HTML_REPORT_FILE)}`,
    ];
    const findings: Finding[] = [];
    for (const batch of splitFileArguments(pages, command, process.platform)) {
        const result = await runCheckTool(session, planned, [...command, ...batch], { cwd: build.cwd });
        if (![0, 1].includes(result.code)) throw new Error(`HTML validation failed: ${result.stderr}`);
        const parsed = parseOutput(planned.check, readBytes(reports.path, HTML_REPORT_FILE).toString('utf8'), '', {
            root: build.folder,
            cwd: build.folder,
        });
        if (result.code === 1 && parsed.length === 0)
            throw new Error(`HTML validation failed without findings: ${result.stderr}`);
        findings.push(
            ...parsed.map((finding) => ({
                ...finding,
                file: joinBuildFolder(planned, finding.file),
            })),
        );
    }
    return findings;
}

/**
Reports selectors in built stylesheets that no built page or script uses.

@param session the repository and its tools.
@param planned the scope whose site to check.
@returns one finding for each unused selector.
*/
export async function checkSitePurgecss(session: CheckSession, planned: PlannedCheck): Promise<Finding[]> {
    const build = await readSuccessfulBuild(session, planned);
    const sheets = listBuiltFiles(build.folder).filter((path) => path.endsWith(CSS_EXTENSION));
    if (sheets.length === 0) return [];
    const configFile = join(session.root, getConfigFilePath(session, planned, PURGECSS_TOOL));
    const result = await runCheckTool(
        session,
        planned,
        {
            tool: PURGECSS_TOOL,
            modulePath: join(import.meta.dirname, PURGECSS_PROCESS + extname(import.meta.filename)),
        },
        { cwd: build.folder, stdin: JSON.stringify({ configFile, css: sheets, content: PURGECSS_CONTENT }) },
    );
    if (result.code !== 0) throw new Error(`Unused CSS analysis failed: ${result.stderr}`);
    const report = parseToolReport('PurgeCSS', result.stdout, purgecssReportSchema);
    return report.flatMap((sheet) =>
        sheet.rejected.map((selector) =>
            buildFinding(
                planned,
                {
                    file: joinBuildFolder(
                        planned,
                        isAbsolute(sheet.file) ? relative(build.folder, sheet.file) : sheet.file,
                    ),
                    line: 1,
                },
                'unused-selector',
                `No built page uses the selector ${selector.trim()}.`,
            ),
        ),
    );
}

/**
Compares the compressed size of built files with each size limit.

@param session the repository and its tools.
@param planned the scope with the size limits.
@returns one finding per exceeded limit.
*/
export async function checkSiteSize(session: CheckSession, planned: PlannedCheck): Promise<Finding[]> {
    const limits = getTable(planned.scope.settings, 'site').size_limit.map((limit) => ({
        ...limit,
        isCounted: buildPathMatcher(limit.paths),
    }));
    const build = await readSuccessfulBuild(session, planned);
    const sizes = new Map(
        listBuiltFiles(build.folder)
            .map((source) => ({ source, path: joinBuildFolder(planned, source) }))
            .filter(({ path }) => limits.some((limit) => limit.isCounted(path)))
            .map(({ source, path }) => [path, gzipSync(readBytes(build.folder, source)).length]),
    );
    return limits.flatMap((limit) => {
        const bytes = [...sizes].filter(([path]) => limit.isCounted(path)).reduce((sum, [, size]) => sum + size, 0);
        const weight = Math.ceil(bytes / BYTES_PER_KILOBYTE);
        return weight <= limit.kilobytes
            ? []
            : [
                  buildFinding(
                      planned,
                      { file: SETTINGS_FILE, line: 1 },
                      'size',
                      `${String(weight)} kB compressed is over the limit of ${String(limit.kilobytes)} kB.`,
                  ),
              ];
    });
}

/**
Reports sitemap URLs with no built page, and built pages the sitemap leaves out unless the settings allow them.

@param session the repository and its tools.
@param planned the scope whose site to check.
@returns the findings.
*/
export async function checkSiteSitemap(session: CheckSession, planned: PlannedCheck): Promise<Finding[]> {
    const build = await readSuccessfulBuild(session, planned);
    const files = new Set(listBuiltFiles(build.folder));
    const sitemapFile = [...files].find((file) => SITEMAP_FILE.test(file));
    if (sitemapFile === undefined) return [];
    const { urls, findings } = readSitemapUrls(build.folder, files, planned);
    const listed = new Set(urls.flatMap((url) => listPossiblePages(url.pathname)));
    const isLeftOut = buildPathMatcher(getTable(planned.scope.settings, 'site').allowed_unlisted_pages);
    const missing = urls
        .filter((url) => listPossiblePages(url.pathname).every((page) => !files.has(page)))
        .map((url) =>
            buildFinding(
                planned,
                {
                    file: joinBuildFolder(planned, sitemapFile),
                    line: 1,
                },
                'missing-page',
                `The sitemap lists ${url.href}, and the build wrote no such page.`,
            ),
        );
    const unlisted = [...files]
        .filter(
            (path) => path.endsWith(HTML_EXTENSION) && !listed.has(path) && !isLeftOut(joinBuildFolder(planned, path)),
        )
        .map((path) =>
            buildFinding(
                planned,
                { file: joinBuildFolder(planned, path), line: 1 },
                'unlisted-page',
                'The build wrote this page, and the sitemap does not list it.',
            ),
        );
    return [...findings, ...missing, ...unlisted];
}
