import { pathToFileURL } from 'node:url';
import { getTable } from '#cli/settings/tables.ts';
import { escapeRegExp } from '#cli/system/patterns.ts';
import { parseOutput } from '#cli/engine/outputs/formats.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import { runCheckTool } from '#cli/engine/run/tool-runs/tool.ts';
import { EXCLUDE_FLAG } from '#cli/config/configurations/shared.ts';
import { splitFileArguments } from '#cli/engine/run/tool-runs/batches.ts';
import { assertToolFindings } from '#cli/engine/run/tool-runs/failures.ts';
import { clearOutsideLinkExit } from '#cli/engine/run/tool-runs/output.ts';
import type { CheckCode, CheckFinding, CheckSession } from '#cli/types/engine/run.ts';
import { readSitemapUrls } from '#cli/configurations/framework/site/checks/sitemap.ts';
import { readSuccessfulBuild } from '#cli/configurations/framework/site/checks/build.ts';

import {
    REMAP_FLAG,
    LYCHEE_TOOL,
    HTML_EXTENSION,
    LYCHEE_ARGUMENTS,
    ROOT_FOLDER_FLAG,
} from '#cli/config/configurations/site.ts';

async function checkLychee(session: CheckSession, planned: PlannedCheck): Promise<CheckFinding[]> {
    const build = await readSuccessfulBuild(session, planned);
    const pages = new Set(build.files);
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
        const finished = await runCheckTool(session, planned, [...command, ...batch], { cwd: build.folder });
        const result = clearOutsideLinkExit(planned.check, finished, build.root);
        const parsed = assertToolFindings(
            result,
            parseOutput(planned.check, result.stdout, result.stderr, { root: build.root, cwd: build.folder }),
            LYCHEE_TOOL,
        );
        findings.push(...parsed);
    }
    return findings;
}

export const SITE_LYCHEE_CHECKS: Readonly<Record<string, CheckCode>> = {
    'site/lychee': { check: checkLychee },
};
