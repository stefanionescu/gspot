import { z } from 'zod';
import { gzipSync } from 'node:zlib';
import { pathMatcher } from '#cli/repository/paths.ts';
import { readSource } from '#cli/repository/tracked.ts';
import { mutationPath } from '#cli/platform/safe-paths.ts';
import { runCheckCommand } from '#cli/execution/tool-runner.ts';
import { isAbsolute, join, relative as relativePath } from 'node:path';
import type { EngineInput, Finding } from '#cli/types/checks/checks.ts';
import type { SiteBuild, SizeLimit } from '#cli/types/checks/static-site.ts';
import { filesUnder, requireSiteBuild } from '#cli/checks/static-site/build.ts';
import { BYTES_PER_KB, SITEMAP_LOCATION } from '#cli/constants/checks/static-site.ts';

function finding(input: EngineInput, file: string, rule: string, text: string, line = 1): Finding {
    return { check: input.spec.name, file, line, rule, message: text, fixable: false };
}

function relative(input: EngineInput, build: SiteBuild, absolute: string): string {
    const path = relativePath(build.cwd, absolute).replaceAll('\\', '/');
    mutationPath(path);
    return input.scope === '' ? path : `${input.scope}/${path}`;
}

async function brokenLinks(input: EngineInput, isExternal: boolean): Promise<Finding[]> {
    const build = await requireSiteBuild(input);
    const skipped = ((input.view.tool('linkinator')['skip'] as { pattern?: string }[] | undefined) ?? []).flatMap(
        (entry) => (entry.pattern === undefined ? [] : [entry.pattern]),
    );
    const skips = [
        ...(isExternal ? [] : ['^https?://(?!localhost)']),
        '^mailto:',
        '^tel:',
        '^sms:',
        ...skipped,
    ].flatMap((pattern) => ['--skip', pattern]);
    const result = await runCheckCommand(
        input,
        ['linkinator', '.', '--recurse', '--server-root', '.', '--format', 'json', ...skips],
        { cwd: build.output },
    );
    if (result.code !== 0 && result.code !== 1) throw new Error(`Linkinator failed: ${result.stderr}`);
    const start = result.stdout.indexOf('{');
    if (start === -1) throw new Error('Linkinator returned no JSON report.');
    const report = z
        .object({
            links: z.array(
                z.object({
                    url: z.string(),
                    state: z.enum(['OK', 'BROKEN', 'SKIPPED']),
                    status: z.number().optional(),
                    parent: z.string().optional(),
                }),
            ),
        })
        .parse(JSON.parse(result.stdout.slice(start)));
    if (result.code === 1 && !report.links.some((link) => link.state === 'BROKEN'))
        throw new Error(`Linkinator failed without reporting broken links: ${result.stderr}`);
    return report.links
        .filter((link) => link.state === 'BROKEN')
        .map((link) =>
            finding(input, link.parent ?? '', 'broken-link', `${link.url} answers ${String(link.status ?? 0)}.`),
        );
}

function pageOf(url: string): string[] {
    const path = decodeURIComponent(new URL(url, 'https://site.invalid').pathname).replace(/^\//u, '');
    if (path === '' || path.endsWith('/')) return [`${path}index.html`];
    return path.endsWith('.html') ? [path] : [`${path}.html`, `${path}/index.html`];
}

/**
 * html-validate over every built page, with the configuration for built output.
 * @param input the engine input
 * @returns the findings
 */
export async function builtMarkup(input: EngineInput): Promise<Finding[]> {
    const build = await requireSiteBuild(input);
    const pages = filesUnder(build.output)
        .filter((path) => path.endsWith('.html'))
        .map((path) => join(build.output, path));
    if (pages.length === 0) return [];
    const config = join(input.root, '.gspot/config/html-validate-built.json');
    const result = await runCheckCommand(
        input,
        ['html-validate', '--config', config, '--formatter', 'json', ...pages],
        {
            cwd: build.cwd,
        },
    );
    if (result.code !== 0 && result.code !== 1) throw new Error(`HTML validation failed: ${result.stderr}`);
    const files = z
        .array(
            z.object({
                filePath: z.string(),
                messages: z.array(z.object({ ruleId: z.string(), line: z.number(), message: z.string() })),
            }),
        )
        .parse(JSON.parse(result.stdout));
    if (result.code === 1 && files.every((file) => file.messages.length === 0))
        throw new Error(`HTML validation failed without diagnostics: ${result.stderr}`);
    return files.flatMap((file) =>
        file.messages.map((entry) =>
            finding(input, relative(input, build, file.filePath), entry.ruleId, entry.message, entry.line),
        ),
    );
}

/**
 * The selectors of the built stylesheets that no built page or script uses.
 * @param input the engine input
 * @returns one finding for each unused selector
 */
export async function deadSelectors(input: EngineInput): Promise<Finding[]> {
    const build = await requireSiteBuild(input);
    const sheets = filesUnder(build.output).filter((path) => path.endsWith('.css'));
    if (sheets.length === 0) return [];
    const safelist = ((input.view.tool('purgecss')['safelist'] as { names?: string[] }[] | undefined) ?? []).flatMap(
        (entry) => entry.names ?? [],
    );
    const argv = [
        'purgecss',
        '--css',
        ...sheets,
        '--content',
        '**/*.html',
        '**/*.js',
        '--rejected',
        ...(safelist.length === 0 ? [] : ['--safelist', ...safelist]),
    ];
    const result = await runCheckCommand(input, argv, { cwd: build.output });
    if (result.code !== 0) throw new Error(`Unused CSS analysis failed: ${result.stderr}`);
    const report = z
        .array(z.object({ file: z.string().min(1), rejected: z.array(z.string()) }))
        .parse(JSON.parse(result.stdout));
    if (report.length !== sheets.length) throw new Error('Unused CSS analysis returned an incomplete report.');
    return report.flatMap((sheet) =>
        sheet.rejected.map((selector) =>
            finding(
                input,
                relative(input, build, isAbsolute(sheet.file) ? sheet.file : join(build.output, sheet.file)),
                'dead-selector',
                `No built page uses the selector ${selector.trim()}.`,
            ),
        ),
    );
}

/**
 * The links between the built pages, their stylesheets and their fragments.
 * @param input the engine input
 * @returns one finding for each broken link
 */
export function internalLinks(input: EngineInput): Promise<Finding[]> {
    return brokenLinks(input, false);
}

/**
 * Every link of the built pages, the ones that leave the site included.
 * @param input the engine input
 * @returns one finding for each broken link
 */
export function externalLinks(input: EngineInput): Promise<Finding[]> {
    return brokenLinks(input, true);
}

/**
 * The compressed weight of the output paths each ceiling names.
 * @param input the engine input
 * @returns one finding for each ceiling passed
 */
export async function sizeLimits(input: EngineInput): Promise<Finding[]> {
    const limits = input.view.tool('site')['size_limits'] as SizeLimit[];
    const build = await requireSiteBuild(input);
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
                  finding(
                      input,
                      limit.paths.join(', '),
                      'size',
                      `${String(weight)} kB compressed is over the ceiling of ${String(limit.kb)} kB.`,
                  ),
              ];
    });
}

/**
 * The sitemap against the output: every route it lists is a built page, and every built page is listed unless the policy leaves it out.
 * @param input the engine input
 * @returns the findings
 */
export async function sitemapMatches(input: EngineInput): Promise<Finding[]> {
    const build = await requireSiteBuild(input);
    const files = new Set(filesUnder(build.output));
    if (!files.has('sitemap.xml')) return [];
    const urls = readSource(build.output, 'sitemap.xml')
        .toString('utf8')
        .matchAll(SITEMAP_LOCATION)
        .map((match) => match.groups?.['url'])
        .filter((url) => url !== undefined)
        .toArray();
    const listed = new Set(urls.flatMap((url) => pageOf(url)));
    const isLeftOut = pathMatcher((input.view.tool('site')['sitemap_allowed'] as string[] | undefined) ?? ['404.html']);
    const missing = urls
        .filter((url) => pageOf(url).every((page) => !files.has(page)))
        .map((url) =>
            finding(
                input,
                'sitemap.xml',
                'missing-page',
                `The sitemap lists ${url}, and the build wrote no such page.`,
            ),
        );
    const unlisted = [...files]
        .filter((path) => path.endsWith('.html') && !listed.has(path) && !isLeftOut(path))
        .map((path) =>
            finding(input, path, 'unlisted-page', 'The build wrote this page, and the sitemap does not list it.'),
        );
    return [...missing, ...unlisted];
}
