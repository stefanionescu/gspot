import { extname, isAbsolute, join, relative } from 'node:path';

import {
    CSS_EXTENSION,
    PURGECSS_CONTENT,
    PURGECSS_PROCESS,
    PURGECSS_TOOL,
    SITE_RULES,
    STYLE_COMPONENTS,
    STYLE_EXTENSIONS,
    STYLE_SCOPING,
} from '#cli/config/configurations/site.ts';
import { WHITESPACE_RUN } from '#cli/config/system.ts';
import { convertToBuildPath, readSuccessfulBuild } from '#cli/configurations/framework/site/checks/build.ts';
import { getConfigPath } from '#cli/engine/run/tool-runs/configs.ts';
import { runCheckTool } from '#cli/engine/run/tool-runs/tool.ts';
import { parseSource } from '#cli/parsers/code/grammars.ts';
import { parseToolOutput } from '#cli/parsers/formats/tool-output.ts';
import { listOwnFiles } from '#cli/repository/scopes.ts';
import { purgecssOutputSchema } from '#cli/schemas/configurations.ts';
import { readText } from '#cli/system/files/reads.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckCode, CheckFinding, CheckSession } from '#cli/types/engine/run.ts';

async function readScopeStyles(session: CheckSession, planned: PlannedCheck): Promise<string> {
    const files = listOwnFiles(session.repository.files, session.scopes, planned.scope.path).filter(
        (file) =>
            file.kind === 'source' &&
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
    return styles.join('\n').replaceAll(WHITESPACE_RUN, '');
}

async function checkPurgecss(session: CheckSession, planned: PlannedCheck): Promise<CheckFinding[]> {
    const build = await readSuccessfulBuild(session, planned);
    const sheets = build.files.filter((path) => path.endsWith(CSS_EXTENSION));
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
                const owned = selector.replaceAll(STYLE_SCOPING, '').replaceAll(WHITESPACE_RUN, '');
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

export const SITE_PURGECSS_CHECKS: Readonly<Record<string, CheckCode>> = {
    'site/purgecss': { check: checkPurgecss },
};
