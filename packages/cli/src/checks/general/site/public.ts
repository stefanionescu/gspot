import { gzipSync } from 'node:zlib';
import { join, isAbsolute } from 'node:path';
import { findingAt } from '#cli/checks/finding.ts';
import { scratchFolder } from '#cli/platform/scratch.ts';
import { readSource } from '#cli/platform/root/public.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import { pathMatcher } from '#cli/repository/paths/public.ts';
import { BYTES_PER_KB } from '#cli/config/platform/runtime.ts';
import { POLICY_FILE } from '#cli/config/platform/locations.ts';
import { runCheckTool } from '#cli/execution/command/public.ts';
import type { CheckInput } from '#cli/types/execution/check.ts';
import { targetInScope } from '#cli/configurations/contracts.ts';
import { fileBatches } from '#cli/execution/command/arguments/contracts.ts';
import { filesUnder, requireBuild, repositoryPath } from '#cli/checks/general/site/contracts.ts';
import { purgecssReportSchema, linkinatorReportSchema, htmlValidationReportSchema } from '#cli/parsers/schema/site.ts';

import {
    SITEMAP_FILES,
    HTTP_OK_STATUS,
    HTML_REPORT_FILE,
    SITEMAP_LOCATION,
    PURGECSS_PROGRAM,
    LINKINATOR_PROGRAM,
} from '#cli/config/checks/general/site.ts';

function pageOf(url: string): [string, ...string[]] {
    const path = decodeURIComponent(new URL(url, 'https://site.invalid').pathname).replace(/^\//u, '');
    if (path === '' || path.endsWith('/')) return [`${path}index.html`];
    return path.endsWith('.html') ? [path] : [path, `${path}.html`, `${path}/index.html`];
}

/**
 * The broken links of the built site: between its pages, stylesheets, and fragments, or every link with the external
 * ones included.
 * @param input the check input
 * @param isExternal whether the links that leave the site count
 * @returns one finding for each broken link
 */
export async function linkinator(input: CheckInput, isExternal: boolean): Promise<Finding[]> {
    const build = await requireBuild(input);
    const pages = new Set(filesUnder(build.output));
    const sitemap = SITEMAP_FILES.find((path) => pages.has(path));
    const location =
        sitemap === undefined
            ? undefined
            : readSource(build.output, sitemap)
                  .toString('utf8')
                  .matchAll(SITEMAP_LOCATION)
                  .map((match) => match.groups?.['url'])
                  .find((url) => url !== undefined);
    const paths = [...pages].filter((path) => path.endsWith('.html'));
    const result = await runCheckTool(
        input,
        { tool: 'linkinator', entry: LINKINATOR_PROGRAM },
        {
            cwd: build.output,
            stdin: JSON.stringify({
                paths,
                origin: location === undefined ? undefined : new URL(location).origin,
                external: isExternal,
                skipped: input.view.options('links').allowed_urls,
            }),
        },
    );
    if (result.code !== 0 && result.code !== 1) throw new Error(`Linkinator failed: ${result.stderr}`);
    const start = result.stdout.indexOf('{');
    if (start === -1) throw new Error('Linkinator returned no JSON report.');
    const report = linkinatorReportSchema.parse(JSON.parse(result.stdout.slice(start)));
    if (result.code === 1 && !report.links.some((link) => link.state === 'BROKEN'))
        throw new Error(`Linkinator failed without reporting broken links: ${result.stderr}`);
    return report.links
        .filter((link) => link.state === 'BROKEN')
        .map((link) => {
            const candidates = pageOf(link.parent ?? '');
            const page = candidates.find((path) => pages.has(path)) ?? candidates[0];
            return findingAt(
                input,
                { file: repositoryPath(input, build, join(build.output, page)), line: 1 },
                'broken-link',
                link.status === HTTP_OK_STATUS && link.url.includes('#')
                    ? `${link.url} has no matching fragment.`
                    : `${link.url} answers ${String(link.status ?? 0)}.`,
            );
        });
}

/**
 * html-validate over every built page, with the configuration for built output.
 * @param input the check input
 * @returns the findings
 */
export async function htmlValidate(input: CheckInput): Promise<Finding[]> {
    const build = await requireBuild(input);
    const pages = filesUnder(build.output)
        .filter((path) => path.endsWith('.html'))
        .map((path) => join(build.output, path));
    if (pages.length === 0) return [];
    const configuration = input.manifests
        .values()
        .flatMap((manifest) => manifest.toolFiles)
        .find((target) => target.check.includes(input.check.name));
    if (configuration === undefined) throw new Error(`Check ${input.check.name} has no declared HTML configuration.`);
    const config = join(input.root, targetInScope(input.scope, configuration));
    using reports = scratchFolder('gspot-html-validate-');
    const command = [
        'html-validate',
        '--config',
        config,
        '--formatter',
        `json=${join(reports.path, HTML_REPORT_FILE)}`,
    ];
    const findings: Finding[] = [];
    for (const batch of fileBatches(pages, command, process.platform)) {
        const result = await runCheckTool(input, [...command, ...batch], { cwd: build.cwd });
        if (![0, 1].includes(result.code)) throw new Error(`HTML validation failed: ${result.stderr}`);
        const files = htmlValidationReportSchema.parse(
            JSON.parse(readSource(reports.path, HTML_REPORT_FILE).toString('utf8')),
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
 * @param input the check input
 * @returns one finding for each unused selector
 */
export async function purgecss(input: CheckInput): Promise<Finding[]> {
    const build = await requireBuild(input);
    const sheets = filesUnder(build.output).filter((path) => path.endsWith('.css'));
    if (sheets.length === 0) return [];
    const configuration = input.manifests
        .values()
        .flatMap((manifest) => manifest.toolFiles)
        .find((target) => target.check.includes(input.check.name));
    if (configuration === undefined) throw new Error(`Check ${input.check.name} has no declared CSS configuration.`);
    const config = join(input.root, targetInScope(input.scope, configuration));
    const result = await runCheckTool(
        input,
        { tool: 'purgecss', entry: PURGECSS_PROGRAM },
        { cwd: build.output, stdin: JSON.stringify({ configuration: config, css: sheets }) },
    );
    if (result.code !== 0) throw new Error(`Unused CSS analysis failed: ${result.stderr}`);
    const report = purgecssReportSchema.parse(JSON.parse(result.stdout));
    if (report.length !== sheets.length) throw new Error('Unused CSS analysis returned an incomplete report.');
    return report.flatMap((sheet) =>
        sheet.rejected.map((selector) =>
            findingAt(
                input,
                {
                    file: repositoryPath(
                        input,
                        build,
                        isAbsolute(sheet.file) ? sheet.file : join(build.output, sheet.file),
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
 * The compressed weight of the output paths each ceiling names.
 * @param input the check input
 * @returns one finding for each ceiling passed
 */
export async function siteSize(input: CheckInput): Promise<Finding[]> {
    const limits = input.view.options('site').max_kilobytes;
    const build = await requireBuild(input);
    const files = filesUnder(build.output);
    return limits.flatMap((limit) => {
        const isCounted = pathMatcher(limit.paths);
        const bytes = files
            .filter((entry) => isCounted(entry))
            .reduce((sum, path) => sum + gzipSync(readSource(build.output, path)).length, 0);
        const weight = Math.ceil(bytes / BYTES_PER_KB);
        return weight <= limit.kb
            ? []
            : [
                  findingAt(
                      input,
                      { file: POLICY_FILE, line: 1 },
                      'size',
                      `${String(weight)} kB compressed is over the ceiling of ${String(limit.kb)} kB.`,
                  ),
              ];
    });
}

/**
 * The sitemap against the output: every route it lists is a built page, and every built page is listed unless the policy leaves it out.
 * @param input the check input
 * @returns the findings
 */
export async function sitemap(input: CheckInput): Promise<Finding[]> {
    const build = await requireBuild(input);
    const files = new Set(filesUnder(build.output));
    if (!files.has('sitemap.xml')) return [];
    const urls = readSource(build.output, 'sitemap.xml')
        .toString('utf8')
        .matchAll(SITEMAP_LOCATION)
        .map((match) => match.groups?.['url'])
        .filter((url) => url !== undefined)
        .toArray();
    const listed = new Set(urls.flatMap((url) => pageOf(url)));
    const isLeftOut = pathMatcher(input.view.options('site').sitemap_exclude);
    const missing = urls
        .filter((url) => pageOf(url).every((page) => !files.has(page)))
        .map((url) =>
            findingAt(
                input,
                { file: repositoryPath(input, build, join(build.output, 'sitemap.xml')), line: 1 },
                'missing-page',
                `The sitemap lists ${url}, and the build wrote no such page.`,
            ),
        );
    const unlisted = [...files]
        .filter((path) => path.endsWith('.html') && !listed.has(path) && !isLeftOut(path))
        .map((path) =>
            findingAt(
                input,
                { file: repositoryPath(input, build, join(build.output, path)), line: 1 },
                'unlisted-page',
                'The build wrote this page, and the sitemap does not list it.',
            ),
        );
    return [...missing, ...unlisted];
}
