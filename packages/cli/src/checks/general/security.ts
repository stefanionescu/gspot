import { z } from 'zod';
import { join } from 'node:path';
import { scratchFolder } from '#cli/system/files.ts';
import { emptyResult } from '#cli/execution/report.ts';
import { readSource } from '#cli/system/file-reads.ts';
import type { SchemaShape } from '#cli/types/objects.ts';
import { targetInScope } from '#cli/repository/scopes.ts';
import { sarifFindings } from '#cli/parsers/output/sarif.ts';
import { runCheckTool } from '#cli/execution/command/tool.ts';
import { runCheckCommand } from '#cli/execution/command/check.ts';
import { toolDeclaration } from '#cli/configurations/tool-pins.ts';
import { toolOutputDetail } from '#cli/execution/command/output.ts';
import { type Session, type PlannedCheck } from '#cli/types/planning.ts';
import { checkCopyInputs, copyIntoScratch } from '#cli/execution/copy/scratch.ts';
import { type Finding, type CheckInput, type CheckResult } from '#cli/types/execution/check.ts';

import {
    CODEQL,
    RULES_KEY,
    SEMGREP_TOOL,
    CODEQL_SUITES,
    CODEQL_ANALYZE_FLAGS,
    CODEQL_LANGUAGES_COMMAND,
} from '#cli/config/checks/general/security.ts';

async function runCodeql(input: CheckInput, argv: readonly string[], cwd: string, language?: string): Promise<string> {
    const result = await runCheckTool(input, [CODEQL, ...argv], { cwd });
    const context = language === undefined ? CODEQL : `${CODEQL} for ${language}`;
    if (result.code !== 0)
        throw new Error(`${context} ${argv[0] ?? ''} ${argv[1] ?? ''} failed: ${toolOutputDetail(result)}`);
    return result.stdout;
}

async function analyzeLanguage(
    input: CheckInput,
    language: string,
    version: string,
    suite: string,
    work: string,
    source: string,
): Promise<Finding[]> {
    const database = join(work, language);
    const output = join(work, `${language}.sarif`);
    await runCodeql(
        input,
        ['database', 'create', database, `--language=${language}`, '--source-root', source, '--overwrite'],
        source,
        language,
    );
    const queries = `codeql/${language}-queries@${version}:codeql-suites/${language}-${suite}.qls`;
    await runCodeql(
        input,
        ['database', 'analyze', database, queries, ...CODEQL_ANALYZE_FLAGS, `--output=${output}`],
        source,
        language,
    );
    return sarifFindings(
        JSON.parse(readSource(work, `${language}.sarif`).toString('utf8')),
        input.check.name,
        input.check.help,
        source,
    ).map((finding) => ({ ...finding, rule: finding.rule ?? CODEQL }));
}

/** CodeQL resolve-languages metadata for selecting one extractor and query pack per language. */
const codeqlLanguagesSchema = z.object({
    aliases: z.record(z.string(), z.string()),
    extractors: z.record(z.string(), z.array(z.unknown())),
} satisfies SchemaShape<{ aliases: Record<string, string>; extractors: Record<string, unknown[]> }>);

/**
 * The selected Semgrep packs and repository rule paths for one scope.
 * @param session the current level and applied tool targets.
 * @param planned the selected scope and its authored rules.
 * @returns the required rule paths, relative to the repository.
 */
function semgrepRuleFiles(session: Session, planned: PlannedCheck): string[] {
    const { selected, scope, view } = planned.scope;
    const generatedPaths = session.generatedPaths();
    const declared = selected.flatMap((manifest) =>
        manifest.toolFiles
            .filter((file) => file.tool.includes(SEMGREP_TOOL) && file.rule_keys?.includes(RULES_KEY) === true)
            .filter((file) => file.level !== 'all' || session.settingsFile.settings.level === 'all')
            .map((file) => targetInScope(scope.path, file, generatedPaths)),
    );
    return [...new Set([...declared, ...view.options('tools.semgrep').rule_files])];
}

/**
 * Runs CodeQL for every language in tools.codeql.languages and returns its findings.
 * @param input the check input.
 * @returns the findings.
 */
export async function codeql(input: CheckInput): Promise<Finding[]> {
    const { languages } = input.selection.view.options(`tools.${CODEQL}`);
    const suite = CODEQL_SUITES[input.settingsFile.settings.level];
    if (languages.length === 0) return [];
    const metadata = codeqlLanguagesSchema.parse(
        JSON.parse(await runCodeql(input, CODEQL_LANGUAGES_COMMAND, input.root)),
    );
    const packs = toolDeclaration(input.manifests.values(), CODEQL).query_packs;
    const selected = [...new Set(languages.map((language) => metadata.aliases[language] ?? language))].map(
        (language) => {
            const version = packs?.[language];
            if (version === undefined) throw new Error(`No CodeQL query pack is pinned for ${language}.`);
            if (metadata.extractors[language]?.length !== 1)
                throw new Error(`CodeQL has no single extractor for ${language}.`);
            return { language, version };
        },
    );
    using workFolder = scratchFolder();
    const work = workFolder.path;
    using scratch = await copyIntoScratch(checkCopyInputs(input));
    const source = scratch.path;
    const findings: Finding[] = [];
    for (const language of selected)
        findings.push(...(await analyzeLanguage(input, language.language, language.version, suite, work, source)));
    return findings;
}

/**
 * Run the selected Semgrep packs and authored rule paths through the command runner.
 * @param session the repository and installed tools.
 * @param planned the check for one scope and its required rules.
 * @returns findings and execution failures.
 */
export async function semgrep(session: Session, planned: PlannedCheck): Promise<CheckResult> {
    const command = planned.check.command as string[];
    const rules = semgrepRuleFiles(session, planned);
    if (rules.length === 0)
        return {
            ...emptyResult(planned),
            status: 'skipped',
            note: 'No selected configuration or tools.semgrep.rule_files supplies local rules.',
        };
    return runCheckCommand(session, planned, {
        command: [...command, ...rules.flatMap((path) => ['--config', join(session.root, path)])],
    });
}
