import { z } from 'zod';
import { tmpdir } from 'node:os';
import { mkdtempSync, rmSync } from 'node:fs';
import { toolPin } from '#cli/tools/probe.ts';
import type { Finding } from '#cli/checks/result.ts';
import { pathMatcher } from '#cli/repository/paths.ts';
import type { EngineInput } from '#cli/checks/input.ts';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readSource } from '#cli/repository/tracked.ts';
import { isAbsolute, join, relative, sep } from 'node:path';
import { mutationTarget } from '#cli/platform/filesystem.ts';
import { scratchCopy } from '#cli/execution/file-workspace.ts';
import { runCheckCommand } from '#cli/execution/tool-runner.ts';
import { codePoints } from '#cli/platform/code-points.ts';

type AcceptedResult = { rule: string; paths: string[]; reason: string };

const TOOL = 'codeql';
const DEFAULT_SUITE = 'security-extended';

function isAccepted(accepted: AcceptedResult[], rule: string, file: string): boolean {
    return accepted.some((entry) => entry.rule === rule && pathMatcher(entry.paths)(file));
}

async function spawned(input: EngineInput, argv: string[], cwd: string): Promise<string> {
    const result = await runCheckCommand(input, [TOOL, ...argv], { cwd });
    if (result.code !== 0)
        throw new Error(
            `${TOOL} ${argv[0] ?? ''} ${argv[1] ?? ''} failed: ${result.stderr.trim().split('\n').at(-1) ?? ''}`,
        );
    return result.stdout;
}

async function scanned(
    input: EngineInput,
    language: string,
    suite: string,
    work: string,
    accepted: AcceptedResult[],
    version: string,
): Promise<Finding[]> {
    const database = join(work, language);
    const output = join(work, `${language}.sarif`);
    const source = scratchCopy(
        input.root,
        input.files.map((file) => file.path),
        input.scopeEntries.map((scope) => scope.path),
    );
    try {
        await spawned(
            input,
            ['database', 'create', database, `--language=${language}`, '--source-root', source, '--overwrite'],
            source,
        );
        const queries = `codeql/${language}-queries@${version}:codeql-suites/${language}-${suite}.qls`;
        await spawned(
            input,
            ['database', 'analyze', database, queries, '--download', '--format=sarif-latest', `--output=${output}`],
            source,
        );
        return sarifFindings(
            JSON.parse(readSource(work, `${language}.sarif`).toString('utf8')),
            input.spec.name,
            accepted,
            source,
        );
    } finally {
        rmSync(source, { recursive: true, force: true });
    }
}

const artifactLocation = z.object({
    uri: z.string().optional(),
    uriBaseId: z.string().optional(),
    index: z.number().int().nonnegative().optional(),
});
const sarifResult = z.object({
    ruleId: z.string().optional(),
    message: z.object({ text: z.string().optional() }).optional(),
    locations: z
        .array(
            z.object({
                physicalLocation: z
                    .object({
                        artifactLocation: artifactLocation.optional(),
                        region: z
                            .object({
                                startLine: z.number().int().positive().optional(),
                                startColumn: z.number().int().positive().optional(),
                                charOffset: z.number().int().min(-1).optional(),
                            })
                            .optional(),
                    })
                    .optional(),
            }),
        )
        .optional(),
});
const sarifRun = z.object({
    results: z.array(sarifResult),
    artifacts: z.array(z.object({ location: artifactLocation.optional(), encoding: z.string().optional() })).optional(),
    defaultEncoding: z.string().optional(),
    columnKind: z.enum(['utf16CodeUnits', 'unicodeCodePoints']).optional(),
    newlineSequences: z.array(z.string().min(1)).min(1).optional(),
    originalUriBaseIds: z.record(z.string(), artifactLocation).optional(),
    invocations: z
        .array(
            z.object({
                executionSuccessful: z.boolean().optional(),
                toolExecutionNotifications: z.array(z.object({ level: z.string().optional() })).optional(),
            }),
        )
        .optional(),
});
const sarifLog = z.object({ version: z.literal('2.1.0'), runs: z.array(sarifRun).min(1) });

function placeOf(
    result: z.infer<typeof sarifResult>,
    run: z.infer<typeof sarifRun>,
    source: string,
): { file: string; line: number; column?: number } {
    const location = result.locations?.[0]?.physicalLocation;
    let artifact = location?.artifactLocation;
    if (artifact?.uri === undefined && artifact?.index !== undefined) {
        artifact = run.artifacts?.[artifact.index]?.location;
        if (artifact?.uri === undefined) throw new Error('CodeQL reported a missing artifact location.');
    }
    const root = pathToFileURL(`${source}${sep}`);
    const baseOf = (id: string, seen = new Set<string>()): URL => {
        if (seen.has(id)) throw new Error('CodeQL reported a cyclic source location.');
        seen.add(id);
        const base = run.originalUriBaseIds?.[id];
        if (base === undefined) {
            if (id === '%SRCROOT%') return root;
            throw new Error(`CodeQL reported an unknown source location: ${id}.`);
        }
        return new URL(base.uri ?? '', base.uriBaseId === undefined ? root : baseOf(base.uriBaseId, seen));
    };
    let file = '';
    if (artifact?.uri !== undefined) {
        const uri = new URL(artifact.uri, artifact.uriBaseId === undefined ? root : baseOf(artifact.uriBaseId));
        if (uri.protocol !== 'file:') throw new Error('CodeQL reported a source location that is not a file.');
        file = relative(source, fileURLToPath(uri));
        if (isAbsolute(file) || file === '..' || file.startsWith(`..${sep}`))
            throw new Error('CodeQL reported a source location outside its selected source copy.');
        file = file.split(sep).join('/');
    }
    const region = location?.region;
    if (region?.charOffset !== undefined && region.charOffset >= 0 && region.startLine === undefined) {
        if (file === '') throw new Error('CodeQL reported a character offset without a source file.');
        const index = location?.artifactLocation?.index;
        const encoding =
            (index === undefined ? undefined : run.artifacts?.[index]?.encoding) ?? run.defaultEncoding ?? 'utf-8';
        const text = new TextDecoder(encoding, { fatal: true }).decode(readSource(source, file));
        const characters = codePoints(text);
        if (region.charOffset > characters.length)
            throw new Error('CodeQL reported a character offset beyond the source file.');
        const prefix = characters.slice(0, region.charOffset).join('');
        const breaks = run.newlineSequences ?? ['\r\n', '\n'];
        let line = 1;
        let start = 0;
        for (let cursor = 0; cursor < prefix.length; ) {
            const newline = breaks.find((sequence) => prefix.startsWith(sequence, cursor));
            if (newline === undefined) cursor += 1;
            else {
                cursor += newline.length;
                line += 1;
                start = cursor;
            }
        }
        const tail = prefix.slice(start);
        return {
            file,
            line,
            column: (run.columnKind === 'unicodeCodePoints' ? codePoints(tail).length : tail.length) + 1,
        };
    }
    return {
        file,
        line: region?.startLine ?? 1,
        ...(region?.startColumn === undefined ? {} : { column: region.startColumn }),
    };
}

/**
 * Validate a CodeQL report and apply accepted results to repository-relative source locations.
 * @param log the parsed SARIF log
 * @param check the check name the findings carry
 * @param accepted the results the policy accepts
 * @param source the copy of the repository the analysis ran in
 * @returns the findings the policy does not accept
 */
export function sarifFindings(log: unknown, check: string, accepted: AcceptedResult[], source: string): Finding[] {
    const parsed = sarifLog.parse(log);
    return parsed.runs.flatMap((run) => {
        if (
            run.invocations?.some(
                (invocation) =>
                    invocation.executionSuccessful === false ||
                    invocation.toolExecutionNotifications?.some((notification) => notification.level === 'error'),
            )
        )
            throw new Error('CodeQL reported an unsuccessful analysis. Repair the native scan before retrying.');
        return run.results
            .map((result) => ({
                check,
                ...placeOf(result, run, source),
                rule: result.ruleId ?? TOOL,
                message: result.message?.text ?? 'CodeQL reports a result here.',
                fixable: false,
            }))
            .filter((finding) => !isAccepted(accepted, finding.rule, finding.file));
    });
}

/**
 * Runs CodeQL for every language in tools.codeql.languages and returns the results the policy does not accept.
 * @param input the engine input
 * @returns the findings
 */
export async function codeql(input: EngineInput): Promise<Finding[]> {
    const tool = input.view.tool(TOOL);
    const languages = (tool['languages'] as string[] | undefined) ?? [];
    const suite = (tool['suite'] as string | undefined) ?? DEFAULT_SUITE;
    const accepted = (tool['false_positives'] as AcceptedResult[] | undefined) ?? [];
    for (const language of languages) {
        mutationTarget(language);
        mutationTarget(`${language}.sarif`);
    }
    if (languages.length === 0) return [];
    const metadata = z
        .object({
            aliases: z.record(z.string(), z.string()),
            extractors: z.record(z.string(), z.array(z.unknown())),
        })
        .parse(
            JSON.parse(
                await spawned(
                    input,
                    ['resolve', 'languages', '--format=betterjson', '--filter-to-languages-with-queries'],
                    input.root,
                ),
            ),
        );
    const packs = toolPin(input.manifests.values(), TOOL).query_packs;
    const selected = [...new Set(languages.map((language) => metadata.aliases[language] ?? language))].map(
        (language) => {
            const version = packs?.[language];
            if (version === undefined || metadata.extractors[language]?.length !== 1)
                throw new Error(`CodeQL language ${language} has no unambiguous extractor and pinned query pack.`);
            return { language, version };
        },
    );
    const work = mkdtempSync(join(tmpdir(), 'gspot-codeql-'));
    const findings: Finding[] = [];
    try {
        for (const { language, version } of selected) {
            findings.push(...(await scanned(input, language, suite, work, accepted, version)));
        }
    } finally {
        rmSync(work, { recursive: true, force: true });
    }
    return findings;
}
