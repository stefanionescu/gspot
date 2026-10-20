import { z } from 'zod';
import { gzipSync } from 'node:zlib';
import { buildFinding } from '#cli/runs/finding.ts';
import { parseReport } from '#cli/runs/output/json.ts';
import { readBytes } from '#cli/system/files/reads.ts';
import { join, relative, isAbsolute } from 'node:path';
import type { SchemaShape } from '#cli/types/shapes.ts';
import { runCheckTool } from '#cli/runs/command/tool.ts';
import { BYTES_PER_KILOBYTE } from '#cli/config/units.ts';
import { parseOutput } from '#cli/runs/output/formats.ts';
import { buildPathMatcher } from '#cli/repository/matchers.ts';
import { SETTINGS_FILE } from '#cli/config/system/locations.ts';
import { splitFileArguments } from '#cli/runs/command/batches.ts';
import { createScratchFolder } from '#cli/system/files/folders.ts';
import { selectToolFilePath } from '#cli/runs/command/placeholders.ts';
import { type Finding, type CheckInput } from '#cli/types/runs/check.ts';
import { listBuiltFiles, getSuccessfulBuild, deriveBuiltFilePath } from '#cli/checks/site/build.ts';

import {
    PURGECSS,
    INDEX_PAGE,
    LINKINATOR,
    BROKEN_LINK,
    SITEMAP_FILE,
    HTML_VALIDATE,
    CSS_EXTENSION,
    HTTP_OK_STATUS,
    HTML_EXTENSION,
    HTML_REPORT_FILE,
    PURGECSS_CONTENT,
    SITEMAP_LOCATION,
    PURGECSS_PROCESS,
    LINKINATOR_STATES,
    LINKINATOR_PROCESS,
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
            if (new URL(url).pathname.endsWith('.xml')) {
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

/** The Linkinator JSON output. */
const linkinatorReportSchema = z.object({
    links: z.array(
        z.object({
            url: z.string(),
            state: z.enum(LINKINATOR_STATES),
            status: z.number().optional(),
            parent: z.string().optional(),
        } satisfies SchemaShape<{
            url: string;
            state: (typeof LINKINATOR_STATES)[number];
            status?: number | undefined;
            parent?: string | undefined;
        }>),
    ),
} satisfies SchemaShape<{
    links: {
        url: string;
        state: (typeof LINKINATOR_STATES)[number];
        status?: number | undefined;
        parent?: string | undefined;
    }[];
}>);

/** The unused selectors in each built stylesheet. */
const purgecssReportSchema = z.array(
    z.object({ file: z.string().min(1), rejected: z.array(z.string()) } satisfies SchemaShape<{
        file: string;
        rejected: string[];
    }>),
) satisfies z.ZodType<{ file: string; rejected: string[] }[]>;

/**
 * Reports broken links between built pages, stylesheets, and fragments.
 *
 * @param input the scope whose site to check.
 * @returns one finding for each broken link.
 */
export async function checkSiteLinkinator(input: CheckInput): Promise<Finding[]> {
    const build = await getSuccessfulBuild(input);
    const pages = new Set(listBuiltFiles(build.folder));
    const location = readSitemapUrls(build.folder, pages)[0];
    const paths = [...pages].filter((path) => path.endsWith(HTML_EXTENSION));
    const result = await runCheckTool(
        input,
        { tool: LINKINATOR, entry: LINKINATOR_PROCESS },
        {
            cwd: build.folder,
            stdin: JSON.stringify({
                paths,
                origin: location === undefined ? undefined : new URL(location).origin,
                skipped: input.selection.view.options('docs').allowed_urls,
            }),
        },
    );
    if (result.code !== 0 && result.code !== 1) throw new Error(`Linkinator failed: ${result.stderr}`);
    const start = result.stdout.indexOf('{');
    if (start === -1) throw new Error('Linkinator returned no JSON report.');
    const report = parseReport('linkinator', result.stdout.slice(start), linkinatorReportSchema);
    if (result.code === 1 && !report.links.some((link) => link.state === BROKEN_LINK))
        throw new Error(`Linkinator failed without reporting broken links: ${result.stderr}`);
    return report.links
        .filter((link) => link.state === BROKEN_LINK)
        .map((link) => {
            const candidates = listCandidatePages(link.parent ?? '');
            const page = candidates.find((path) => pages.has(path)) ?? candidates[0];
            return buildFinding(
                input,
                { file: deriveBuiltFilePath(input, page), line: 1 },
                'broken-link',
                link.status === HTTP_OK_STATUS && link.url.includes('#')
                    ? `${link.url} has no matching fragment.`
                    : `${link.url} answers ${String(link.status ?? 0)}.`,
            );
        });
}

/**
 * Runs html-validate on every built page with the tool file for built output.
 *
 * @param input the scope whose site to check.
 * @returns the findings.
 */
export async function checkSiteHtmlValidate(input: CheckInput): Promise<Finding[]> {
    const build = await getSuccessfulBuild(input);
    const pages = listBuiltFiles(build.folder)
        .filter((path) => path.endsWith(HTML_EXTENSION))
        .map((path) => join(build.folder, path));
    if (pages.length === 0) return [];
    const toolFile = join(input.root, selectToolFilePath(input, input, HTML_VALIDATE));
    using reports = createScratchFolder();
    const command = [
        HTML_VALIDATE,
        '--config',
        toolFile,
        '--formatter',
        `json=${join(reports.path, HTML_REPORT_FILE)}`,
    ];
    const findings: Finding[] = [];
    for (const batch of splitFileArguments(pages, command, process.platform)) {
        const result = await runCheckTool(input, [...command, ...batch], { cwd: build.cwd });
        if (![0, 1].includes(result.code)) throw new Error(`HTML validation failed: ${result.stderr}`);
        const parsed = parseOutput(input.check, readBytes(reports.path, HTML_REPORT_FILE).toString('utf8'), '', {
            root: build.folder,
            cwd: build.folder,
        });
        if (result.code === 1 && parsed.length === 0)
            throw new Error(`HTML validation failed without findings: ${result.stderr}`);
        findings.push(
            ...parsed.map((finding) => ({
                ...finding,
                file: deriveBuiltFilePath(input, finding.file),
            })),
        );
    }
    return findings;
}

/**
 * Reports selectors in built stylesheets that no built page or script uses.
 *
 * @param input the scope whose site to check.
 * @returns one finding for each unused selector.
 */
export async function checkSitePurgecss(input: CheckInput): Promise<Finding[]> {
    const build = await getSuccessfulBuild(input);
    const sheets = listBuiltFiles(build.folder).filter((path) => path.endsWith(CSS_EXTENSION));
    if (sheets.length === 0) return [];
    const toolFile = join(input.root, selectToolFilePath(input, input, PURGECSS));
    const result = await runCheckTool(
        input,
        { tool: PURGECSS, entry: PURGECSS_PROCESS },
        { cwd: build.folder, stdin: JSON.stringify({ toolFile, css: sheets, content: PURGECSS_CONTENT }) },
    );
    if (result.code !== 0) throw new Error(`Unused CSS analysis failed: ${result.stderr}`);
    const report = parseReport('PurgeCSS', result.stdout, purgecssReportSchema);
    return report.flatMap((sheet) =>
        sheet.rejected.map((selector) =>
            buildFinding(
                input,
                {
                    file: deriveBuiltFilePath(
                        input,
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
 * @param input the scope with the size limits.
 * @returns one finding per exceeded limit.
 */
export async function checkSiteSize(input: CheckInput): Promise<Finding[]> {
    const limits = input.selection.view.options('site').size_limit;
    const build = await getSuccessfulBuild(input);
    const files = listBuiltFiles(build.folder);
    return limits.flatMap((limit) => {
        const isCounted = buildPathMatcher(limit.paths);
        const bytes = files
            .filter((entry) => isCounted(deriveBuiltFilePath(input, entry)))
            .reduce((sum, path) => sum + gzipSync(readBytes(build.folder, path)).length, 0);
        const weight = Math.ceil(bytes / BYTES_PER_KILOBYTE);
        return weight <= limit.kilobytes
            ? []
            : [
                  buildFinding(
                      input,
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
 * @param input the scope whose site to check.
 * @returns the findings.
 */
export async function checkSiteSitemap(input: CheckInput): Promise<Finding[]> {
    const build = await getSuccessfulBuild(input);
    const files = new Set(listBuiltFiles(build.folder));
    const sitemapFile = [...files].find((file) => SITEMAP_FILE.test(file));
    if (sitemapFile === undefined) return [];
    const urls = readSitemapUrls(build.folder, files);
    const listed = new Set(urls.flatMap((url) => listCandidatePages(new URL(url).pathname)));
    const isLeftOut = buildPathMatcher(input.selection.view.options('site').allowed_unlisted_pages);
    const missing = urls
        .filter((url) => listCandidatePages(new URL(url).pathname).every((page) => !files.has(page)))
        .map((url) =>
            buildFinding(
                input,
                {
                    file: deriveBuiltFilePath(input, sitemapFile),
                    line: 1,
                },
                'missing-page',
                `The sitemap lists ${url}, and the build wrote no such page.`,
            ),
        );
    const unlisted = [...files]
        .filter(
            (path) =>
                path.endsWith(HTML_EXTENSION) && !listed.has(path) && !isLeftOut(deriveBuiltFilePath(input, path)),
        )
        .map((path) =>
            buildFinding(
                input,
                { file: deriveBuiltFilePath(input, path), line: 1 },
                'unlisted-page',
                'The build wrote this page, and the sitemap does not list it.',
            ),
        );
    return [...missing, ...unlisted];
}
