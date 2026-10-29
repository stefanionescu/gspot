import { gzipSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';
import { getTable } from '#cli/settings/scopes.ts';
import { runCheckTool } from '#cli/runs/command/tool.ts';
import { BYTES_PER_KILOBYTE } from '#cli/config/units.ts';
import { parseOutput } from '#cli/runs/output/formats.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import type { CheckSession } from '#cli/types/session.ts';
import { buildPathMatcher } from '#cli/system/matchers.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { parseSource } from '#cli/parsers/code/grammars.ts';
import { selectScopePath } from '#cli/repository/scopes.ts';
import { SETTINGS_FILE } from '#cli/config/settings/file.ts';
import type { CheckFinding } from '#cli/types/runs/check.ts';
import { parseToolOutput } from '#cli/parsers/formats/json.ts';
import { assertToolFindings } from '#cli/runs/command/output.ts';
import { splitFileArguments } from '#cli/runs/command/batches.ts';
import { LEADING_SLASH } from '#cli/config/files/path-patterns.ts';
import { createTemporaryFolder } from '#cli/system/files/folders.ts';
import { getConfigFilePath } from '#cli/runs/command/placeholders.ts';
import { readBytes, readCachedText } from '#cli/system/files/reads.ts';
import { readSitemapUrls } from '#cli/checks/framework/site/sitemap.ts';
import { join, extname, relative, normalize, isAbsolute } from 'node:path';
import { purgecssOutputSchema } from '#cli/schemas/checks/framework/site.ts';
import { PURGECSS_TOOL } from '#cli/config/checks/framework/site/purgecss-process.ts';
import { listBuiltFiles, readSuccessfulBuild } from '#cli/checks/framework/site/build.ts';

import {
    RULES,
    REMAP_FLAG,
    INDEX_PAGE,
    LYCHEE_TOOL,
    EXCLUDE_FLAG,
    SITEMAP_FILE,
    ROOT_DIR_FLAG,
    CSS_EXTENSION,
    STYLE_SCOPING,
    HTML_EXTENSION,
    STYLE_EXTENSIONS,
    STYLE_COMPONENTS,
    STYLE_WHITESPACE,
    PURGECSS_CONTENT,
    PURGECSS_PROCESS,
    LYCHEE_ARGUMENTS,
    HTML_VALIDATE_TOOL,
    HTML_VALIDATE_OUTPUT,
    UNLISTED_PAGE_MESSAGE,
    HTML_VALIDATE_CONFIG_FLAG,
    HTML_VALIDATE_FORMATTER_FLAG,
} from '#cli/config/checks/framework/site/pages.ts';

function listPossiblePages(pathname: string): [string, ...string[]] {
    const path = decodeURIComponent(pathname).replace(LEADING_SLASH, '');
    if (path === '' || path.endsWith('/')) return [`${path}${INDEX_PAGE}`];
    return path.endsWith(HTML_EXTENSION) ? [path] : [path, `${path}${HTML_EXTENSION}`, `${path}/${INDEX_PAGE}`];
}

function appendBuildFindings(findings: CheckFinding[], parsed: CheckFinding[], folder: string): void {
    for (const finding of parsed) {
        const file = `${folder}/${convertToPosixPath(normalize(finding.file))}`;
        findings.push({ ...finding, file });
    }
}

/**
Reports broken links between built pages, stylesheets, and fragments.

@param session the repository and its tools.
@param planned the scope whose site to check.
*/
export async function checkSiteLychee(session: CheckSession, planned: PlannedCheck): Promise<CheckFinding[]> {
    const build = await readSuccessfulBuild(session, planned);
    const pages = new Set(listBuiltFiles(build.folder));
    const { urls, base } = readSitemapUrls(build.folder, pages, planned);
    const location = urls[0];
    const buildUrl = `${pathToFileURL(build.folder).href}/`;
    const paths = [...pages].filter((path) => path.endsWith(HTML_EXTENSION));
    if (paths.length === 0) return [];
    const command = [
        LYCHEE_TOOL,
        ...LYCHEE_ARGUMENTS,
        ROOT_DIR_FLAG,
        build.folder,
        ...(location === undefined
            ? []
            : [
                  REMAP_FLAG,
                  `^${RegExp.escape(location.origin + base)} ${buildUrl}`,
                  REMAP_FLAG,
                  `^${RegExp.escape(buildUrl + base.slice(1))} ${buildUrl}`,
              ]),
        ...getTable(planned.scope.settings, 'docs').allowed_urls.flatMap((value) => [EXCLUDE_FLAG, value]),
    ];
    const findings: CheckFinding[] = [];
    for (const batch of splitFileArguments(paths, command, process.platform)) {
        const result = await runCheckTool(session, planned, [...command, ...batch], { cwd: build.folder });
        const parsed = assertToolFindings(
            result,
            parseOutput(planned.check, result.stdout, result.stderr, { root: build.folder, cwd: build.folder }),
            LYCHEE_TOOL,
        );
        appendBuildFindings(findings, parsed, getTable(planned.scope.settings, 'site').build_folder);
    }
    return findings;
}

/**
Runs html-validate on every built page with the config file for built output.

@param session the repository and its tools.
@param planned the scope whose site to check.
*/
export async function checkSiteHtmlValidate(session: CheckSession, planned: PlannedCheck): Promise<CheckFinding[]> {
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
        `json=${join(reports.path, HTML_VALIDATE_OUTPUT)}`,
    ];
    const findings: CheckFinding[] = [];
    for (const batch of splitFileArguments(pages, command, process.platform)) {
        const result = await runCheckTool(session, planned, [...command, ...batch], { cwd: build.cwd });
        if (![0, 1].includes(result.code)) throw new Error(`HTML validation failed: ${result.stderr}`);
        const parsed = parseOutput(planned.check, readBytes(reports.path, HTML_VALIDATE_OUTPUT).toString('utf8'), '', {
            root: build.folder,
            cwd: build.folder,
        });
        if (result.code === 1 && parsed.length === 0)
            throw new Error(`HTML validation failed without findings: ${result.stderr}`);
        appendBuildFindings(findings, parsed, getTable(planned.scope.settings, 'site').build_folder);
    }
    return findings;
}

async function readScopeStyles(session: CheckSession, planned: PlannedCheck): Promise<string> {
    const files = session.repository.files.filter(
        (file) =>
            file.kind === 'source' &&
            selectScopePath(file.path, session.scopes) === planned.scope.path &&
            (STYLE_EXTENSIONS.has(extname(file.path)) || STYLE_COMPONENTS.has(extname(file.path))),
    );
    const styles: string[] = [];
    for (const file of files) {
        const text = readCachedText(session.reads, file.path);
        if (STYLE_EXTENSIONS.has(extname(file.path))) {
            styles.push(text);
            continue;
        }
        const tree = await parseSource('html', text, session);
        try {
            styles.push(
                ...tree.rootNode
                    .descendantsOfType('style_element')
                    .flatMap((node) =>
                        node.namedChildren.filter((child) => child.type === 'raw_text').map((child) => child.text),
                    ),
            );
        } finally {
            tree.delete();
        }
    }
    return styles.join('\n').replaceAll(STYLE_WHITESPACE, '');
}

/**
Reports selectors in built stylesheets that no built page or script uses.

@param session the repository and its tools.
@param planned the scope whose site to check.
*/
export async function checkSitePurgecss(session: CheckSession, planned: PlannedCheck): Promise<CheckFinding[]> {
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
    const report = parseToolOutput('PurgeCSS', result.stdout, purgecssOutputSchema);
    const styles = await readScopeStyles(session, planned);
    return report.flatMap((sheet) =>
        sheet.rejected
            .filter((selector) => {
                const owned = selector.replaceAll(STYLE_SCOPING, '').replaceAll(STYLE_WHITESPACE, '');
                return owned !== '' && styles.includes(owned);
            })
            .map((selector) => ({
                file: `${getTable(planned.scope.settings, 'site')['build_folder']}/${convertToPosixPath(normalize(isAbsolute(sheet.file) ? relative(build.folder, sheet.file) : sheet.file))}`,
                line: 1,
                rule: RULES.unusedSelector,
                message: `No built page uses the selector ${selector.trim()}.`,
            })),
    );
}

/**
Compares the compressed size of built files with each size limit.

@param session the repository and its tools.
@param planned the scope with the size limits.
@returns one finding per exceeded limit.
*/
export async function checkSiteSize(session: CheckSession, planned: PlannedCheck): Promise<CheckFinding[]> {
    const limits = getTable(planned.scope.settings, 'site').size_limit.map((limit) => ({
        ...limit,
        isCounted: buildPathMatcher(limit.paths),
    }));
    const build = await readSuccessfulBuild(session, planned);
    const sizes = new Map(
        listBuiltFiles(build.folder)
            .map((source) => ({
                source,
                path: `${getTable(planned.scope.settings, 'site')['build_folder']}/${convertToPosixPath(normalize(source))}`,
            }))
            .filter(({ path }) => limits.some((limit) => limit.isCounted(path)))
            .map(({ source, path }) => [path, gzipSync(readBytes(build.folder, source)).length]),
    );
    return limits.flatMap((limit) => {
        const bytes = [...sizes].filter(([path]) => limit.isCounted(path)).reduce((sum, [, size]) => sum + size, 0);
        const weight = Math.ceil(bytes / BYTES_PER_KILOBYTE);
        return weight <= limit.kilobytes
            ? []
            : [
                  {
                      file: SETTINGS_FILE,
                      line: 1,
                      rule: RULES.size,
                      message: `${limit.paths.join(', ')}: ${String(weight)} kB compressed is over the limit of ${String(limit.kilobytes)} kB.`,
                  },
              ];
    });
}

/**
Reports sitemap URLs with no built page, and built pages the sitemap leaves out unless the settings allow them.

@param session the repository and its tools.
@param planned the scope whose site to check.
*/
export async function checkSiteSitemap(session: CheckSession, planned: PlannedCheck): Promise<CheckFinding[]> {
    const build = await readSuccessfulBuild(session, planned);
    const files = new Set(listBuiltFiles(build.folder));
    const sitemapFile = [...files].find((file) => SITEMAP_FILE.test(file));
    if (sitemapFile === undefined) return [];
    const { urls, findings, base } = readSitemapUrls(build.folder, files, planned);
    const listed = new Set(
        urls.flatMap((url) =>
            listPossiblePages(url.pathname.startsWith(base) ? url.pathname.slice(base.length) : url.pathname),
        ),
    );
    const isLeftOut = buildPathMatcher(getTable(planned.scope.settings, 'site').allowed_unlisted_pages);
    const missing = urls
        .filter((url) =>
            listPossiblePages(url.pathname.startsWith(base) ? url.pathname.slice(base.length) : url.pathname).every(
                (page) => !files.has(page),
            ),
        )
        .map((url) => ({
            file: `${getTable(planned.scope.settings, 'site')['build_folder']}/${convertToPosixPath(normalize(sitemapFile))}`,
            line: 1,
            rule: RULES.missingPage,
            message: `The sitemap lists ${url.href}, and the build wrote no such page.`,
        }));
    const unlisted = [...files]
        .filter(
            (path) =>
                path.endsWith(HTML_EXTENSION) &&
                !listed.has(path) &&
                !isLeftOut(
                    `${getTable(planned.scope.settings, 'site')['build_folder']}/${convertToPosixPath(normalize(path))}`,
                ),
        )
        .map((path) => ({
            file: `${getTable(planned.scope.settings, 'site')['build_folder']}/${convertToPosixPath(normalize(path))}`,
            line: 1,
            rule: RULES.unlistedPage,
            message: UNLISTED_PAGE_MESSAGE,
        }));
    return [...findings, ...missing, ...unlisted];
}
