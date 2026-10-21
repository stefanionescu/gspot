import { gzipSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';
import { buildFinding } from '#cli/runs/finding.ts';
import type { Session } from '#cli/types/session.ts';
import { parseToolReport } from '#cli/parsers/json.ts';
import { getTable } from '#cli/settings/scope-view.ts';
import { readBytes } from '#cli/system/files/reads.ts';
import { join, relative, isAbsolute } from 'node:path';
import type { Finding } from '#cli/types/runs/check.ts';
import { runCheckTool } from '#cli/runs/command/tool.ts';
import { BYTES_PER_KILOBYTE } from '#cli/config/units.ts';
import { parseOutput } from '#cli/runs/output/formats.ts';
import { SETTINGS_FILE } from '#cli/config/gspot-paths.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { buildPathMatcher } from '#cli/repository/matchers.ts';
import { assertToolFindings } from '#cli/runs/command/output.ts';
import { splitFileArguments } from '#cli/runs/command/batches.ts';
import { createTemporaryFolder } from '#cli/system/files/folders.ts';
import { selectToolFilePath } from '#cli/runs/command/placeholders.ts';
import { purgecssReportSchema } from '#cli/schemas/checks/site/pages.ts';
import { listBuiltFiles, getSuccessfulBuild, buildRepositoryPath } from '#cli/checks/site/build.ts';

import {
    LYCHEE,
    PURGECSS,
    INDEX_PAGE,
    SITEMAP_FILE,
    HTML_VALIDATE,
    CSS_EXTENSION,
    HTML_EXTENSION,
    LYCHEE_ARGUMENTS,
    HTML_REPORT_FILE,
    PURGECSS_CONTENT,
    SITEMAP_LOCATION,
    PURGECSS_PROCESS,
    SITEMAP_EXTENSION,
    HTML_VALIDATE_CONFIG_FLAG,
    HTML_VALIDATE_FORMATTER_FLAG,
} from '#cli/config/checks/site.ts';

function readSitemapUrls(folder: string, files: ReadonlySet<string>): string[] {
    const visited = new Set<string>();
    const urls = new Set<string>();

    const read = (file: string): void => {
        if (visited.has(file)) return;
        visited.add(file);
        for (const url of readBytes(folder, file)
            .toString('utf8')
            .matchAll(SITEMAP_LOCATION)
            .map((match) => match.groups?.['url'])
            .filter((url) => url !== undefined)) {
            if (new URL(url).pathname.endsWith(SITEMAP_EXTENSION)) {
                const nested = decodeURIComponent(new URL(url).pathname).replace(/^\//u, '');
                if (files.has(nested)) read(nested);
            } else urls.add(url);
        }
    };
    for (const file of files) if (SITEMAP_FILE.test(file)) read(file);
    return [...urls];
}

function listCandidatePages(pathname: string): [string, ...string[]] {
    const path = decodeURIComponent(pathname.replace(/[?#][\s\S]*/u, '')).replace(/^\//u, '');
    if (path === '' || path.endsWith('/')) return [`${path}${INDEX_PAGE}`];
    return path.endsWith(HTML_EXTENSION) ? [path] : [path, `${path}${HTML_EXTENSION}`, `${path}/${INDEX_PAGE}`];
}

/**
 * Reports broken links between built pages, stylesheets, and fragments.
 *
 * @param session the repository and its tools.
 * @param planned the scope whose site to check.
 * @returns one finding for each broken link.
 */
export async function checkSiteLychee(session: Session, planned: PlannedCheck): Promise<Finding[]> {
    const build = await getSuccessfulBuild(session, planned);
    const pages = new Set(listBuiltFiles(build.folder));
    const location = readSitemapUrls(build.folder, pages)[0];
    const paths = [...pages].filter((path) => path.endsWith(HTML_EXTENSION));
    if (paths.length === 0) return [];
    const command = [
        LYCHEE,
        ...LYCHEE_ARGUMENTS,
        '--root-dir',
        build.folder,
        ...(location === undefined
            ? []
            : ['--remap', `^${RegExp.escape(new URL(location).origin)}/ ${pathToFileURL(build.folder).href}/`]),
        ...getTable(planned.selection.view, 'docs').allowed_urls.flatMap((value) => ['--exclude', value]),
    ];
    const findings: Finding[] = [];
    for (const batch of splitFileArguments(paths, command, process.platform)) {
        const result = await runCheckTool(session, planned, [...command, ...batch], { cwd: build.folder });
        const parsed = assertToolFindings(
            result,
            parseOutput(planned.check, result.stdout, result.stderr, { root: build.folder, cwd: build.folder }),
            LYCHEE,
        );
        findings.push(...parsed.map((finding) => ({ ...finding, file: buildRepositoryPath(planned, finding.file) })));
    }
    return findings;
}

/**
 * Runs html-validate on every built page with the tool file for built output.
 *
 * @param session the repository and its tools.
 * @param planned the scope whose site to check.
 * @returns the findings.
 */
export async function checkSiteHtmlValidate(session: Session, planned: PlannedCheck): Promise<Finding[]> {
    const build = await getSuccessfulBuild(session, planned);
    const pages = listBuiltFiles(build.folder)
        .filter((path) => path.endsWith(HTML_EXTENSION))
        .map((path) => join(build.folder, path));
    if (pages.length === 0) return [];
    const toolFile = join(session.root, selectToolFilePath(session, planned, HTML_VALIDATE));
    using reports = createTemporaryFolder();
    const command = [
        HTML_VALIDATE,
        HTML_VALIDATE_CONFIG_FLAG,
        toolFile,
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
                file: buildRepositoryPath(planned, finding.file),
            })),
        );
    }
    return findings;
}

/**
 * Reports selectors in built stylesheets that no built page or script uses.
 *
 * @param session the repository and its tools.
 * @param planned the scope whose site to check.
 * @returns one finding for each unused selector.
 */
export async function checkSitePurgecss(session: Session, planned: PlannedCheck): Promise<Finding[]> {
    const build = await getSuccessfulBuild(session, planned);
    const sheets = listBuiltFiles(build.folder).filter((path) => path.endsWith(CSS_EXTENSION));
    if (sheets.length === 0) return [];
    const toolFile = join(session.root, selectToolFilePath(session, planned, PURGECSS));
    const result = await runCheckTool(
        session,
        planned,
        { tool: PURGECSS, entry: PURGECSS_PROCESS },
        { cwd: build.folder, stdin: JSON.stringify({ toolFile, css: sheets, content: PURGECSS_CONTENT }) },
    );
    if (result.code !== 0) throw new Error(`Unused CSS analysis failed: ${result.stderr}`);
    const report = parseToolReport('PurgeCSS', result.stdout, purgecssReportSchema);
    return report.flatMap((sheet) =>
        sheet.rejected.map((selector) =>
            buildFinding(
                planned,
                {
                    file: buildRepositoryPath(
                        planned,
                        isAbsolute(sheet.file) ? relative(build.folder, sheet.file) : sheet.file,
                    ),
                    line: 1,
                },
                'dead-selector',
                `No built page uses the selector ${selector.trim()}.`,
            ),
        ),
    );
}

/**
 * Compares the compressed size of built files with each size limit.
 *
 * @param session the repository and its tools.
 * @param planned the scope with the size limits.
 * @returns one finding per exceeded limit.
 */
export async function checkSiteSize(session: Session, planned: PlannedCheck): Promise<Finding[]> {
    const limits = getTable(planned.selection.view, 'site').size_limit.map((limit) => ({
        ...limit,
        isCounted: buildPathMatcher(limit.paths),
    }));
    const build = await getSuccessfulBuild(session, planned);
    const sizes = new Map(
        listBuiltFiles(build.folder)
            .map((source) => ({ source, path: buildRepositoryPath(planned, source) }))
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
 * Reports sitemap URLs with no built page, and built pages the sitemap leaves out unless the settings allow them.
 *
 * @param session the repository and its tools.
 * @param planned the scope whose site to check.
 * @returns the findings.
 */
export async function checkSiteSitemap(session: Session, planned: PlannedCheck): Promise<Finding[]> {
    const build = await getSuccessfulBuild(session, planned);
    const files = new Set(listBuiltFiles(build.folder));
    const sitemapFile = [...files].find((file) => SITEMAP_FILE.test(file));
    if (sitemapFile === undefined) return [];
    const urls = readSitemapUrls(build.folder, files);
    const listed = new Set(urls.flatMap((url) => listCandidatePages(new URL(url).pathname)));
    const isLeftOut = buildPathMatcher(getTable(planned.selection.view, 'site').allowed_unlisted_pages);
    const missing = urls
        .filter((url) => listCandidatePages(new URL(url).pathname).every((page) => !files.has(page)))
        .map((url) =>
            buildFinding(
                planned,
                {
                    file: buildRepositoryPath(planned, sitemapFile),
                    line: 1,
                },
                'missing-page',
                `The sitemap lists ${url}, and the build wrote no such page.`,
            ),
        );
    const unlisted = [...files]
        .filter(
            (path) =>
                path.endsWith(HTML_EXTENSION) && !listed.has(path) && !isLeftOut(buildRepositoryPath(planned, path)),
        )
        .map((path) =>
            buildFinding(
                planned,
                { file: buildRepositoryPath(planned, path), line: 1 },
                'unlisted-page',
                'The build wrote this page, and the sitemap does not list it.',
            ),
        );
    return [...missing, ...unlisted];
}
