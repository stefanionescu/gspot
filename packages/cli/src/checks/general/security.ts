import { join } from 'node:path';
import { scratchFolder } from '#cli/platform/scratch.ts';
import { readSource } from '#cli/platform/root/public.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import type { ToolSession } from '#cli/types/tools/session.ts';
import { CODEQL } from '#cli/config/checks/general/security.ts';
import { copyIntoScratch } from '#cli/execution/copy/public.ts';
import { codeqlLanguagesSchema } from '#cli/parsers/schema/codeql.ts';
import { toolOutputDetail } from '#cli/execution/command/contracts.ts';
import { sarifFindings } from '#cli/parsers/output/structured/public.ts';
import { toolPin, semgrepRuleFiles } from '#cli/configurations/contracts.ts';
import type { CheckInput, CheckResult } from '#cli/types/execution/check.ts';
import { runCheckTool, runCheckCommand } from '#cli/execution/command/public.ts';
import type { CodeqlAnalysis, CodeqlLanguage } from '#cli/types/checks/general/security.ts';

async function runCodeql(input: CheckInput, argv: string[], cwd: string): Promise<string> {
    const result = await runCheckTool(input, [CODEQL, ...argv], { cwd });
    if (result.code !== 0)
        throw new Error(
            `${CODEQL} ${argv[0] ?? ''} ${argv[1] ?? ''} failed: ${toolOutputDetail(result, 'The tool printed no diagnostic.')}`,
        );
    return result.stdout;
}

async function analyzeLanguage(
    input: CheckInput,
    { language, version }: CodeqlLanguage,
    { suite, work, source }: CodeqlAnalysis,
): Promise<Finding[]> {
    const database = join(work, language);
    const output = join(work, `${language}.sarif`);
    await runCodeql(
        input,
        ['database', 'create', database, `--language=${language}`, '--source-root', source, '--overwrite'],
        source,
    );
    const queries = `codeql/${language}-queries@${version}:codeql-suites/${language}-${suite}.qls`;
    await runCodeql(
        input,
        ['database', 'analyze', database, queries, '--download', '--format=sarif-latest', `--output=${output}`],
        source,
    );
    return sarifFindings(
        JSON.parse(readSource(work, `${language}.sarif`).toString('utf8')),
        input.check.name,
        input.check.help,
        source,
    ).map((finding) => ({ ...finding, rule: finding.rule ?? CODEQL }));
}

/**
 * Runs CodeQL for every language in tools.codeql.languages and returns its findings.
 * @param input the check input
 * @returns the findings
 */
export async function codeql(input: CheckInput): Promise<Finding[]> {
    const tool = input.view.options(`tools.${CODEQL}`);
    const languages = (tool['languages'] as string[] | undefined) ?? [];
    const suite = tool['suite'];
    if (languages.length === 0) return [];
    const metadata = codeqlLanguagesSchema.parse(
        JSON.parse(
            await runCodeql(
                input,
                ['resolve', 'languages', '--format=betterjson', '--filter-to-languages-with-queries'],
                input.root,
            ),
        ),
    );
    const packs = toolPin(input.manifests.values(), CODEQL).query_packs;
    const selected = [...new Set(languages.map((language) => metadata.aliases[language] ?? language))].map(
        (language) => {
            const version = packs?.[language];
            if (version === undefined) throw new Error(`No CodeQL query pack is pinned for ${language}.`);
            if (metadata.extractors[language]?.length !== 1)
                throw new Error(`CodeQL has no single extractor for ${language}.`);
            return { language, version };
        },
    );
    using workFolder = scratchFolder('gspot-codeql-');
    const work = workFolder.path;
    using sourceFolder = await copyIntoScratch(input);
    const source = sourceFolder.path;
    const findings: Finding[] = [];
    for (const language of selected) {
        try {
            findings.push(...(await analyzeLanguage(input, language, { suite, work, source })));
        } catch (error) {
            throw new Error(
                `CodeQL analysis of ${language.language} failed: ${error instanceof Error ? error.message : String(error)}`,
                { cause: error },
            );
        }
    }
    return findings;
}

/**
 * Run the selected Semgrep packs and authored rule paths through the native command runner.
 * @param session the repository and installed tools
 * @param planned the scoped check with its required rule declarations
 * @returns native findings and execution failures
 */
export function semgrep(session: ToolSession, planned: PlannedCheck): Promise<CheckResult> {
    const command = planned.check.command;
    if (command === undefined) throw new Error('The Semgrep check has no declared command.');
    const rules = semgrepRuleFiles(
        planned.scope.selected,
        planned.scope.scope.path,
        planned.scope.view.options('tools.semgrep').rule_files,
    ).flatMap((path) => ['--config', join(session.root, path)]);
    return runCheckCommand(session, planned, { command: [...command, ...rules] });
}
