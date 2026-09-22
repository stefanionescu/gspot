import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { globSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { Parser } from 'htmlparser2';
type PageLinks = { path: string; ids: Set<string>; links: string[] };

function inspectPage(path: string, content: string): PageLinks {
    const ids = new Set<string>();
    const links: string[] = [];
    const parser = new Parser({
        onopentag(name, attributes) {
            const id = attributes['id'];
            if (id !== undefined) ids.add(id);
            if (name === 'a' && attributes['name'] !== undefined) ids.add(attributes['name']);
            const reference = attributes['src'] ?? attributes['href'];
            if (reference !== undefined) links.push(reference);
        },
    });
    parser.end(content);
    return { path, ids, links };
}

function routeFor(path: string): string {
    return path.endsWith('/index.html') ? path.slice(0, -'index.html'.length) : path;
}

function targetProblem(
    link: string,
    page: PageLinks,
    origin: string,
    files: Set<string>,
    pages: Map<string, PageLinks>,
): string | undefined {
    const url = new URL(link, new URL(page.path, origin));
    if (url.origin !== origin) return undefined;
    const path = decodeURIComponent(url.pathname);
    const target = pages.get(path) ?? pages.get(`${path}/`);
    if (target === undefined && !files.has(path)) return 'destination does not exist';
    const fragment = decodeURIComponent(url.hash.slice(1));
    if (fragment !== '' && target !== undefined && !target.ids.has(fragment))
        return `fragment #${fragment} does not exist`;
    return undefined;
}

function pageProblems(page: PageLinks, origin: string, files: Set<string>, pages: Map<string, PageLinks>): string[] {
    return page.links.flatMap((link) => {
        try {
            const problem = targetProblem(link, page, origin, files, pages);
            return problem === undefined ? [] : [`${page.path}: ${link}: ${problem}`];
        } catch (error) {
            return [`${page.path}: ${link}: ${String(error)}`];
        }
    });
}

/**
 * Validate local links and fragment targets across the emitted site and assets.
 * @param directory complete build output directory
 * @param site public site origin
 */
export async function validateSiteLinks(directory: URL, site: string): Promise<void> {
    const root = fileURLToPath(directory);
    const files = new Set(
        globSync('**/*', { cwd: root })
            .filter((path) => statSync(join(root, path)).isFile())
            .map((path) => `/${path.replaceAll('\\', '/')}`),
    );
    const pages = new Map<string, PageLinks>();
    for (const path of files) {
        if (!path.endsWith('.html')) continue;
        const page = inspectPage(routeFor(path), await readFile(join(root, path.slice(1)), 'utf8'));
        pages.set(path, page);
        pages.set(page.path, page);
    }
    const origin = new URL(site).origin;
    const failures = [...new Set(pages.values())].flatMap((page) => pageProblems(page, origin, files, pages));
    if (failures.length > 0) throw new Error(`Invalid built-site links:\n${failures.join('\n')}`);
}

if (import.meta.main) {
    if (process.argv.length > 2) throw new Error('The built-site link check accepts no arguments.');
    await validateSiteLinks(new URL('../dist/', import.meta.url), 'https://gspot.dev');
    process.stdout.write('All built-site links and fragment targets are valid.\n');
}
