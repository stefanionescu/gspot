import { z } from 'zod';
import { gzipSync } from 'node:zlib';
import { join, isAbsolute } from 'node:path';
import { findingAt } from '#cli/checks/finding.ts';
import { BYTES_PER_KB } from '#cli/config/units.ts';
import { readBytes } from '#cli/system/files/reads.ts';
import type { SchemaShape } from '#cli/types/objects.ts';
import { pathMatcher } from '#cli/repository/selectors.ts';
import { runCheckTool } from '#cli/execution/command/tool.ts';
import { SETTINGS_FILE } from '#cli/config/system/locations.ts';
import { fileBatches } from '#cli/execution/command/batches.ts';
import { createScratchFolder } from '#cli/system/files/folders.ts';
import { toolFilePath } from '#cli/execution/command/placeholders.ts';
import { type Finding, type CheckInput } from '#cli/types/execution/check.ts';
import { filesUnder, requireBuild, repositoryPath } from '#cli/checks/framework/site/build.ts';

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
    LINKINATOR_STATES,
    LINKINATOR_PROGRAM,
} from '#cli/config/checks/framework/site.ts';

function sitemapUrls(folder: string, files: ReadonlySet<string>): string[] {
    const visited = new Set<string>();
    const urls = new Set<string>();
    // eslint-disable-next-line sonarjs/cognitive-complexity -- reason: The sitemap reader handles routes and URL normalization together; splitting it duplicates the same page context.
    const read = (file: string): void => {
        if (visited.has(file)) return;
        visited.add(file);
        for (const match of readBytes(folder, file).toString('utf8').matchAll(SITEMAP_LOCATION)) {
            const url = match.groups?.['url'];
            if (url === undefined) continue;
            if (new URL(url).pathname.endsWith('.xml')) {
                const nested = decodeURIComponent(new URL(url).pathname).replace(/^\//u, '');
                if (files.has(nested)) read(nested);
            } else urls.add(url);
        }
    };
    for (const file of files) if (SITEMAP_FILE.test(file)) read(file);
    return [...urls];
}

function pageOf(url: string): [string, ...string[]] {
    const path = decodeURIComponent(url === '' ? '/' : new URL(url).pathname).replace(/^\//u, '');
    if (path === '' || path.endsWith('/')) return [`${path}${INDEX_PAGE}`];
    return path.endsWith(HTML_EXTENSION) ? [path] : [path, `${path}${HTML_EXTENSION}`, `${path}/${INDEX_PAGE}`];
}

/** Linkinator output from the static-site build in a scratch copy. */
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

/** HTML diagnostics for every validated output page. */
const htmlValidationReportSchema = z.array(
    z.object({
        filePath: z.string(),
        messages: z.array(
            z.object({ ruleId: z.string(), line: z.number(), message: z.string() } satisfies SchemaShape<{
                ruleId: string;
                line: number;
                message: string;
            }>),
        ),
    } satisfies SchemaShape<{ filePath: string; messages: { ruleId: string; line: number; message: string }[] }>),
) satisfies z.ZodType<{ filePath: string; messages: { ruleId: string; line: number; message: string }[] }[]>;

/** Selectors rejected in each emitted stylesheet. */
const purgecssReportSchema = z.array(
    z.object({ file: z.string().min(1), rejected: z.array(z.string()) } satisfies SchemaShape<{
        file: string;
        rejected: string[];
    }>),
) satisfies z.ZodType<{ file: string; rejected: string[] }[]>;

/**
 * The broken links between built pages, stylesheets, and fragments.
 * @param input the check input.
 * @returns one finding for each broken link.
 */
export async function linkinator(input: CheckInput): Promise<Finding[]> {
    const build = await requireBuild(input);
    const pages = new Set(filesUnder(build.folder));
    const location = sitemapUrls(build.folder, pages)[0];
    const paths = [...pages].filter((path) => path.endsWith(HTML_EXTENSION));
    const result = await runCheckTool(
        input,
        { tool: LINKINATOR, entry: LINKINATOR_PROGRAM },
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
    const report = linkinatorReportSchema.parse(JSON.parse(result.stdout.slice(start)));
    if (result.code === 1 && !report.links.some((link) => link.state === BROKEN_LINK))
        throw new Error(`Linkinator failed without reporting broken links: ${result.stderr}`);
    return report.links
        .filter((link) => link.state === BROKEN_LINK)
        .map((link) => {
            const candidates = pageOf(link.parent ?? '');
            const page = candidates.find((path) => pages.has(path)) ?? candidates[0];
            return findingAt(
                input,
                { file: repositoryPath(input, build, join(build.folder, page)), line: 1 },
                'broken-link',
                link.status === HTTP_OK_STATUS && link.url.includes('#')
                    ? `${link.url} has no matching fragment.`
                    : `${link.url} answers ${String(link.status ?? 0)}.`,
            );
        });
}

/**
 * html-validate over every built page, with the configuration for built files.
 * @param input the check input.
 * @returns the findings.
 */
export async function htmlValidate(input: CheckInput): Promise<Finding[]> {
    const build = await requireBuild(input);
    const pages = filesUnder(build.folder)
        .filter((path) => path.endsWith(HTML_EXTENSION))
        .map((path) => join(build.folder, path));
    if (pages.length === 0) return [];
    const config = join(
        input.root,
        toolFilePath(input, { check: input.check, scope: input.selection, files: input.files }, 'html-validate-built'),
    );
    using reports = createScratchFolder();
    const command = [HTML_VALIDATE, '--config', config, '--formatter', `json=${join(reports.path, HTML_REPORT_FILE)}`];
    const findings: Finding[] = [];
    for (const batch of fileBatches(pages, command, process.platform)) {
        const result = await runCheckTool(input, [...command, ...batch], { cwd: build.cwd });
        if (![0, 1].includes(result.code)) throw new Error(`HTML validation failed: ${result.stderr}`);
        const files = htmlValidationReportSchema.parse(
            JSON.parse(readBytes(reports.path, HTML_REPORT_FILE).toString('utf8')),
        );
        if (result.code === 1 && files.every((file) => file.messages.length === 0))
            throw new Error(`HTML validation failed without diagnostics: ${result.stderr}`);
        findings.push(
            ...files.flatMap((file) =>
                file.messages.map((entry) =>
                    findingAt(
                        input,
                        { file: repositoryPath(input, build, file.filePath), line: entry.line },
                        entry.ruleId,
                        entry.message,
                    ),
                ),
            ),
        );
    }
    return findings;
}

/**
 * The selectors of the built stylesheets that no built page or script uses.
 * @param input the check input.
 * @returns one finding for each unused selector.
 */
export async function purgecss(input: CheckInput): Promise<Finding[]> {
    const build = await requireBuild(input);
    const sheets = filesUnder(build.folder).filter((path) => path.endsWith(CSS_EXTENSION));
    if (sheets.length === 0) return [];
    const config = join(
        input.root,
        toolFilePath(input, { check: input.check, scope: input.selection, files: input.files }, PURGECSS),
    );
    const result = await runCheckTool(
        input,
        [PURGECSS, '--config', config, '--css', ...sheets, '--content', ...PURGECSS_CONTENT, '--rejected'],
        { cwd: build.folder },
    );
    if (result.code !== 0) throw new Error(`Unused CSS analysis failed: ${result.stderr}`);
    const report = purgecssReportSchema.parse(JSON.parse(result.stdout));
    return report.flatMap((sheet) =>
        sheet.rejected.map((selector) =>
            findingAt(
                input,
                {
                    file: repositoryPath(
                        input,
                        build,
                        isAbsolute(sheet.file) ? sheet.file : join(build.folder, sheet.file),
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
 * The compressed weight of the built paths each limit names.
 * @param input the check input.
 * @returns one finding for each limit passed.
 */
export async function siteSize(input: CheckInput): Promise<Finding[]> {
    const limits = input.selection.view.options('site').size_limit;
    const build = await requireBuild(input);
    const files = filesUnder(build.folder);
    return limits.flatMap((limit) => {
        const isCounted = pathMatcher(limit.paths);
        const bytes = files
            .filter((entry) => isCounted(repositoryPath(input, build, join(build.folder, entry))))
            .reduce((sum, path) => sum + gzipSync(readBytes(build.folder, path)).length, 0);
        const weight = Math.ceil(bytes / BYTES_PER_KB);
        return weight <= limit.kilobytes
            ? []
            : [
                  findingAt(
                      input,
                      { file: SETTINGS_FILE, line: 1 },
                      'size',
                      `${String(weight)} kB compressed is over the limit of ${String(limit.kilobytes)} kB.`,
                  ),
              ];
    });
}

/**
 * Compare sitemap routes with built pages. Require each built page unless the settings exclude it.
 * @param input the check input.
 * @returns the findings.
 */
export async function sitemap(input: CheckInput): Promise<Finding[]> {
    const build = await requireBuild(input);
    const files = new Set(filesUnder(build.folder));
    const sitemapFile = [...files].find((file) => SITEMAP_FILE.test(file));
    if (sitemapFile === undefined) return [];
    const urls = sitemapUrls(build.folder, files);
    const listed = new Set(urls.flatMap((url) => pageOf(url)));
    const isLeftOut = pathMatcher(input.selection.view.options('site').allowed_unlisted_pages);
    const missing = urls
        .filter((url) => pageOf(url).every((page) => !files.has(page)))
        .map((url) =>
            findingAt(
                input,
                {
                    file: repositoryPath(input, build, join(build.folder, sitemapFile)),
                    line: 1,
                },
                'missing-page',
                `The sitemap lists ${url}, and the build wrote no such page.`,
            ),
        );
    const unlisted = [...files]
        .filter(
            (path) =>
                path.endsWith(HTML_EXTENSION) &&
                !listed.has(path) &&
                !isLeftOut(repositoryPath(input, build, join(build.folder, path))),
        )
        .map((path) =>
            findingAt(
                input,
                { file: repositoryPath(input, build, join(build.folder, path)), line: 1 },
                'unlisted-page',
                'The build wrote this page, and the sitemap does not list it.',
            ),
        );
    return [...missing, ...unlisted];
}
