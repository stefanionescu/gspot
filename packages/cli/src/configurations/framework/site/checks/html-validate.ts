import { join } from 'node:path';
import { CheckStop } from '#cli/system/errors.ts';
import { readBytes } from '#cli/system/files/reads.ts';
import { CONFIG_FLAG } from '#cli/config/tools/programs.ts';
import { parseOutput } from '#cli/engine/outputs/formats.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import { runCheckTool } from '#cli/engine/run/tool-runs/tool.ts';
import { getConfigPath } from '#cli/engine/run/tool-runs/configs.ts';
import { createTemporaryFolder } from '#cli/system/files/temporary.ts';
import { splitFileArguments } from '#cli/engine/run/tool-runs/batches.ts';
import type { CheckCode, CheckFinding, CheckSession } from '#cli/types/engine/run.ts';
import { readSuccessfulBuild } from '#cli/configurations/framework/site/checks/build.ts';

import {
    HTML_EXTENSION,
    HTML_VALIDATE_TOOL,
    HTML_VALIDATE_OUTPUT,
    HTML_VALIDATE_FORMATTER_FLAG,
} from '#cli/config/configurations/site.ts';

async function checkHtmlValidate(session: CheckSession, planned: PlannedCheck): Promise<CheckFinding[]> {
    const build = await readSuccessfulBuild(session, planned);
    const pages = build.files.filter((path) => path.endsWith(HTML_EXTENSION)).map((path) => join(build.folder, path));
    if (pages.length === 0) return [];
    const config = join(session.root, getConfigPath(session, planned, HTML_VALIDATE_TOOL));
    using reports = createTemporaryFolder();
    const command = [
        HTML_VALIDATE_TOOL,
        CONFIG_FLAG,
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

export const SITE_HTML_VALIDATE_CHECKS: Readonly<Record<string, CheckCode>> = {
    'site/html-validate': { check: checkHtmlValidate },
};
