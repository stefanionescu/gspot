// The checks that read the built output of a static site.
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { run } from '#cli/platform/spawn.ts';
import type { SizeLimit } from '#types/web.ts';
import type { EngineInput } from '#types/run.ts';
import type { Finding } from '#types/finding.ts';
import { pathMatcher } from '#cli/presets/claims.ts';
import { locateTool } from '#cli/platform/tool-probe.ts';
import { filesUnder, siteBuild } from '#cli/web/site/build.ts';
import { MissingToolError } from '#cli/platform/missing-tool.ts';

const TOOL_TIMEOUT_MS = 900_000;
const BYTES_PER_KB = 1024;
const SITEMAP_LOCATION = /<loc>\s*(?<url>[^<\s]+)\s*<\/loc>/gu;

function finding(input: EngineInput, file: string, rule: string, text: string, line = 1): Finding {
    return { check: input.spec.id, file, line, rule, message: text, fixable: false };
}

function tool(input: EngineInput, name: string): string {
    const found = locateTool(input.root, name);
    if (found === undefined) throw new MissingToolError(`The ${name} command is not installed.`);
    return found;
}

function relative(input: EngineInput, absolute: string): string {
    return absolute.startsWith(`${input.root}/`) ? absolute.slice(input.root.length + 1) : absolute;
}

async function brokenLinks(input: EngineInput, isExternal: boolean): Promise<Finding[]> {
    const build = await siteBuild(input);
    if (!build.isBuilt) return [];
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
    const result = await run(
        [tool(input, 'linkinator'), '.', '--recurse', '--server-root', '.', '--format', 'json', ...skips],
        { cwd: build.output, timeoutMs: TOOL_TIMEOUT_MS },
    );
    const start = result.stdout.indexOf('{');
    const report = JSON.parse(start === -1 ? '{}' : result.stdout.slice(start)) as {
        links?: { url: string; state: string; status?: number; parent?: string }[];
    };
    return (report.links ?? [])
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
    const build = await siteBuild(input);
    const pages = filesUnder(build.output)
        .filter((path) => path.endsWith('.html'))
        .map((path) => join(build.output, path));
    if (!build.isBuilt || pages.length === 0) return [];
    const config = join(input.root, '.gspot/html-validate-built.json');
    const result = await run([tool(input, 'html-validate'), '--config', config, '--formatter', 'json', ...pages], {
        cwd: build.cwd,
        timeoutMs: TOOL_TIMEOUT_MS,
    });
    const files = JSON.parse(result.stdout === '' ? '[]' : result.stdout) as {
        filePath: string;
        messages: { ruleId: string; line: number; message: string }[];
    }[];
    return files.flatMap((file) =>
        file.messages.map((entry) =>
            finding(input, relative(input, file.filePath), entry.ruleId, entry.message, entry.line),
        ),
    );
}

/**
 * The selectors of the built stylesheets that no built page or script uses.
 * @param input the engine input
 * @returns one finding for each unused selector
 */
export async function deadSelectors(input: EngineInput): Promise<Finding[]> {
    const build = await siteBuild(input);
    const sheets = filesUnder(build.output).filter((path) => path.endsWith('.css'));
    if (!build.isBuilt || sheets.length === 0) return [];
    const safelist = ((input.view.tool('purgecss')['safelist'] as { names?: string[] }[] | undefined) ?? []).flatMap(
        (entry) => entry.names ?? [],
    );
    const argv = [
        tool(input, 'purgecss'),
        '--css',
        ...sheets,
        '--content',
        '**/*.html',
        '**/*.js',
        '--rejected',
        ...(safelist.length === 0 ? [] : ['--safelist', ...safelist]),
    ];
    const result = await run(argv, { cwd: build.output, timeoutMs: TOOL_TIMEOUT_MS });
    const report = JSON.parse(result.stdout === '' ? '[]' : result.stdout) as { file?: string; rejected?: string[] }[];
    return report.flatMap((sheet) =>
        (sheet.rejected ?? []).map((selector) =>
            finding(
                input,
                relative(input, join(build.output, sheet.file ?? '')),
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
    const limits = (input.view.tool('site')['size_limits'] as SizeLimit[] | undefined) ?? [];
    const build = await siteBuild(input);
    if (limits.length === 0 || !build.isBuilt) return [];
    const files = filesUnder(build.output);
    return limits.flatMap((limit) => {
        const isCounted = pathMatcher(limit.paths);
        const bytes = files
            .filter((path) => isCounted(path))
            .reduce((sum, path) => sum + gzipSync(readFileSync(join(build.output, path))).length, 0);
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
    const build = await siteBuild(input);
    const files = new Set(filesUnder(build.output));
    if (!build.isBuilt || !files.has('sitemap.xml')) return [];
    const urls = readFileSync(join(build.output, 'sitemap.xml'), 'utf8')
        .matchAll(SITEMAP_LOCATION)
        .map((match) => match.groups?.['url'] ?? '')
        .toArray();
    const listed = new Set(urls.flatMap((url) => pageOf(url)));
    const isLeftOut = pathMatcher(
        (input.view.tool('site')['sitemap_excluded'] as string[] | undefined) ?? ['404.html'],
    );
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
