import { pathToFileURL } from 'node:url';
import { CheckStop } from '#cli/system/errors.ts';
import { getTable } from '#cli/settings/scopes.ts';
import { escapeRegExp } from '#cli/system/text.ts';
import { LEADING_SLASH } from '#cli/config/parsers.ts';
import { buildPathMatcher } from '#cli/system/matchers.ts';
import { parseSource } from '#cli/parsers/code/grammars.ts';
import { selectScopePath } from '#cli/repository/scopes.ts';
import { parseOutput } from '#cli/engine/outputs/formats.ts';
import { runCheckTool } from '#cli/engine/tool-runs/tool.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import { parseToolOutput } from '#cli/parsers/formats/json.ts';
import { join, extname, relative, isAbsolute } from 'node:path';
import { readText, readBytes } from '#cli/system/files/reads.ts';
import type { CheckFinding } from '#cli/types/engine/tool-runs.ts';
import { assertToolFindings } from '#cli/engine/tool-runs/output.ts';
import { createTemporaryFolder } from '#cli/system/files/folders.ts';
import { splitFileArguments } from '#cli/engine/tool-runs/batches.ts';
import { getConfigPath } from '#cli/engine/tool-runs/placeholders.ts';
import { purgecssOutputSchema } from '#cli/schemas/configurations.ts';
import { type CheckCode, type CheckSession } from '#cli/types/engine/run.ts';
import { readSitemapUrls } from '#cli/configurations/framework/site/checks/sitemap.ts';
import { SITEMAP_RULE_DOCS } from '#cli/configurations/framework/site/explanations.ts';

import {
    listBuiltFiles,
    convertToBuildPath,
    readSuccessfulBuild,
} from '#cli/configurations/framework/site/checks/build.ts';
import {
    SITE_RULES,
    REMAP_FLAG,
    INDEX_PAGE,
    LYCHEE_TOOL,
    EXCLUDE_FLAG,
    SITEMAP_FILE,
    PURGECSS_TOOL,
    CSS_EXTENSION,
    STYLE_SCOPING,
    HTML_EXTENSION,
    ROOT_FOLDER_FLAG,
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
} from '#cli/config/configurations/framework.ts';

function listPossiblePages(pathname: string): [string, ...string[]] {
    const path = decodeURIComponent(pathname).replace(LEADING_SLASH, '');
    if (path === '' || path.endsWith('/')) return [`${path}${INDEX_PAGE}`];
    return path.endsWith(HTML_EXTENSION) ? [path] : [path, `${path}${HTML_EXTENSION}`, `${path}/${INDEX_PAGE}`];
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
        const text = readText(session.cache, file.path);
        if (STYLE_EXTENSIONS.has(extname(file.path))) {
            styles.push(text);
            continue;
        }
        using tree = await parseSource('html', text, session);
        styles.push(
            ...tree.rootNode
                .descendantsOfType('style_element')
                .flatMap((node) =>
                    node.namedChildren.filter((child) => child.type === 'raw_text').map((child) => child.text),
                ),
        );
    }
    return styles.join('\n').replaceAll(STYLE_WHITESPACE, '');
}

/**
Reports broken links between built pages, stylesheets, and fragments.

@param session the repository and its tools.
@param planned the scope whose site to check.
*/
async function checkLychee(session: CheckSession, planned: PlannedCheck): Promise<CheckFinding[]> {
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
        ROOT_FOLDER_FLAG,
        build.folder,
        ...(location === undefined
            ? []
            : [
                  REMAP_FLAG,
                  `^${escapeRegExp(location.origin + base)} ${buildUrl}`,
                  REMAP_FLAG,
                  `^${escapeRegExp(buildUrl + base.slice(1))} ${buildUrl}`,
              ]),
        ...getTable(planned.scope.settings, 'docs').allowed_urls.flatMap((value) => [EXCLUDE_FLAG, value]),
    ];
    const findings: CheckFinding[] = [];
    for (const batch of splitFileArguments(paths, command, process.platform)) {
        const result = await runCheckTool(session, planned, [...command, ...batch], { cwd: build.folder });
        const parsed = assertToolFindings(
            result,
            parseOutput(planned.check, result.stdout, result.stderr, { root: build.root, cwd: build.folder }),
            LYCHEE_TOOL,
        );
        findings.push(...parsed);
    }
    return findings;
}

/**
Runs html-validate on every built page with the config file for built output.

@param session the repository and its tools.
@param planned the scope whose site to check.
*/
async function checkHtmlValidate(session: CheckSession, planned: PlannedCheck): Promise<CheckFinding[]> {
    const build = await readSuccessfulBuild(session, planned);
    const pages = listBuiltFiles(build.folder)
        .filter((path) => path.endsWith(HTML_EXTENSION))
        .map((path) => join(build.folder, path));
    if (pages.length === 0) return [];
    const config = join(session.root, getConfigPath(session, planned, HTML_VALIDATE_TOOL));
    using reports = createTemporaryFolder();
    const command = [
        HTML_VALIDATE_TOOL,
        HTML_VALIDATE_CONFIG_FLAG,
        config,
        HTML_VALIDATE_FORMATTER_FLAG,
        `json=${join(reports.path, HTML_VALIDATE_OUTPUT)}`,
    ];
    const findings: CheckFinding[] = [];
    for (const batch of splitFileArguments(pages, command, process.platform)) {
        const result = await runCheckTool(session, planned, [...command, ...batch], {
            cwd: build.cwd,
            exitCodes: [1],
        });
        const parsed = parseOutput(planned.check, readBytes(reports.path, HTML_VALIDATE_OUTPUT).toString('utf8'), '', {
            root: build.root,
            cwd: build.folder,
        });
        if (result.code === 1 && parsed.length === 0)
            throw new CheckStop('error', `HTML validation failed without findings: ${result.stderr}`);
        findings.push(...parsed);
    }
    return findings;
}

/**
Reports selectors in built stylesheets that no built page or script uses.

@param session the repository and its tools.
@param planned the scope whose site to check.
*/
async function checkPurgecss(session: CheckSession, planned: PlannedCheck): Promise<CheckFinding[]> {
    const build = await readSuccessfulBuild(session, planned);
    const sheets = listBuiltFiles(build.folder).filter((path) => path.endsWith(CSS_EXTENSION));
    if (sheets.length === 0) return [];
    const config = join(session.root, getConfigPath(session, planned, PURGECSS_TOOL));
    const program = join(import.meta.dirname, PURGECSS_PROCESS + extname(import.meta.filename));
    const result = await runCheckTool(session, planned, [process.execPath, program], {
        cwd: build.folder,
        stdin: JSON.stringify({ config, css: sheets, content: PURGECSS_CONTENT }),
        tool: PURGECSS_TOOL,
        exitCodes: [],
    });
    const report = parseToolOutput('PurgeCSS', result.stdout, purgecssOutputSchema);
    const styles = await readScopeStyles(session, planned);
    return report.flatMap((sheet) =>
        sheet.rejected
            .filter((selector) => {
                const owned = selector.replaceAll(STYLE_SCOPING, '').replaceAll(STYLE_WHITESPACE, '');
                return owned !== '' && styles.includes(owned);
            })
            .map((selector) => ({
                file: convertToBuildPath(
                    planned,
                    isAbsolute(sheet.file) ? relative(build.folder, sheet.file) : sheet.file,
                ),
                line: 1,
                rule: SITE_RULES.unusedSelector,
                message: `No built page uses the selector ${selector.trim()}.`,
            })),
    );
}

/**
Reports sitemap URLs with no built page, and built pages the sitemap leaves out unless the settings allow them.

@param session the repository and its tools.
@param planned the scope whose site to check.
*/
async function checkSitemap(session: CheckSession, planned: PlannedCheck): Promise<CheckFinding[]> {
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

export const SITE_PAGES_CHECKS: Readonly<Record<string, CheckCode>> = {
    'site/html-validate': { check: checkHtmlValidate },
    'site/lychee': { check: checkLychee },
    'site/purgecss': { check: checkPurgecss },
    'site/sitemap': { check: checkSitemap, ruleDocs: SITEMAP_RULE_DOCS },
};
