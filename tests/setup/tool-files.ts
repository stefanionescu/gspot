// Reads generated tool files and ESLint findings for tests.
import ts from 'typescript';
import { ESLint } from 'eslint';
import { testdir } from 'testdirs';
import { parse as parseIni } from 'ini';
import { parse as parseYaml } from 'yaml';
import { readFile } from 'node:fs/promises';
import { openSession } from '#cli/session.ts';
import { join, extname, relative } from 'node:path';
import type { Session } from '#cli/types/session.ts';
import { runGspot } from '#tests/setup/run-gspot.ts';
import { generate } from '#cli/generation/generate.ts';
import { runSandboxStep } from '#tests/setup/install.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import type { Level } from '#cli/types/configurations.ts';
import { parse as parseToml } from '@decimalturn/toml-patch';
import { linkInstalledModules } from '#tests/setup/modules.ts';
import { getToolFiles } from '#cli/generation/settings/generate.ts';
import { type ParseError, parse as parseJsonc } from 'jsonc-parser';
import { buildScopeTarget } from '#cli/generation/settings/needed.ts';
import { extractToolFileName } from '#cli/configurations/declared-tools.ts';
import type { LintFinding, ScriptFindingCase, EslintConfiguration } from '#tests/types/tool-output.ts';

/** Lint the files and keep the findings of these rules and fatal errors, sorted. */
export async function collectLintFindings(
    eslint: ESLint,
    root: string,
    files: readonly string[],
    rules: readonly string[],
): Promise<LintFinding[]> {
    const results = await eslint.lintFiles([...files]);
    return results
        .flatMap(({ filePath, messages }) =>
            messages
                .filter(({ ruleId, fatal }) => fatal || ruleId === null || rules.includes(ruleId))
                .map(({ ruleId, line }) => ({
                    file: convertToPosixPath(relative(root, filePath)),
                    rule: ruleId,
                    line,
                })),
        )
        .toSorted(compareFindings);
}

/**
 * Links the test packages, runs apply, and loads the generated ESLint tool file.
 *
 * @param sandboxRoot folder with a gspot.toml.
 * @param options ESLint options that the test adds.
 * @returns ESLint set up with the generated tool file.
 */
export async function createEslint(sandboxRoot: string, options?: ESLint.Options): Promise<ESLint> {
    await linkInstalledModules(join(sandboxRoot, 'node_modules'));
    await runSandboxStep({ root: sandboxRoot, environment: {}, run: runGspot }, ['apply']);
    const session = await openSession(sandboxRoot);
    const scope = session.scopes.find((selection) =>
        selection.selected.some((configuration) =>
            configuration.toolFiles.some((file) => extractToolFileName(file.file) === 'eslint'),
        ),
    )?.scope.path;
    if (scope === undefined) throw new Error('The sandbox selects no ESLint tool file.');
    return new ESLint({
        ...options,
        cwd: sandboxRoot,
        overrideConfigFile: join(sandboxRoot, toolFileFor(session, 'eslint', scope)),
        overrideConfig: { languageOptions: { parserOptions: { noWarnOnMultipleProjects: true } } },
    });
}

/**
 * Creates a repository with the settings and files, and returns the content of one generated file.
 *
 * @param settings the gspot.toml text.
 * @param path generated file to read.
 * @param files other content for the repository.
 * @returns the generated content.
 */
export async function generateFile(settings: string, path: string, files: Record<string, string>): Promise<string> {
    await using sandbox = await testdir({ ...files, 'gspot.toml': settings });

    const session = await openSession(sandbox.path);
    const output = generate(session);
    const file = output.files.find((entry) => entry.path === path);
    if (file === undefined) throw new Error(`The sandbox generates no ${path}.`);
    return file.content;
}

/** Sort findings by file, line, and rule. */
export function compareFindings(left: LintFinding, right: LintFinding): number {
    return (
        left.file.localeCompare(right.file) ||
        left.line - right.line ||
        (left.rule ?? '').localeCompare(right.rule ?? '')
    );
}
/** Find the generated tool file for a tool and scope. */
export function toolFileFor(session: Session, tool: string, scope = ''): string {
    const declaration = session.scopes
        .find((selection) => selection.scope.path === scope)
        ?.selected.flatMap((configuration) => configuration.toolFiles)
        .find((file) => extractToolFileName(file.file) === tool);
    if (declaration === undefined) throw new Error(`The sandbox generates no ${tool} file for ${scope || 'the root'}.`);
    return buildScopeTarget(scope, declaration, getToolFiles(session).targets);
}

function parseJson(text: string, path: string): void {
    const errors: ParseError[] = [];
    parseJsonc(text, errors, { allowTrailingComma: true });
    if (errors.length > 0) throw new Error(`${path}: JSON error at offset ${String((errors[0] as ParseError).offset)}`);
}
function parseModule(text: string, path: string): void {
    const result = ts.transpileModule(text, { reportDiagnostics: true, fileName: path });
    const errors = (result.diagnostics ?? []).map((message) =>
        ts.flattenDiagnosticMessageText(message.messageText, '\n'),
    );
    if (errors.length > 0) throw new Error(`${path}: ${errors.join('; ')}`);
}

/** Parse a generated tool file with the parser for its extension. */
export function parseToolFile(text: string, path: string): void {
    const parsers: Record<string, (text: string, path: string) => void> = {
        '.cfg': (text) => {
            parseIni(text);
        },
        '.ini': (text) => {
            parseIni(text);
        },
        '.json': (text) => void JSON.parse(text),
        '.jsonc': parseJson,
        '.webmanifest': (text) => void JSON.parse(text),
        '.toml': (text) => {
            parseToml(text);
        },
        '.yml': (text) => void parseYaml(text),
        '.yaml': (text) => void parseYaml(text),
        '.mjs': parseModule,
        '.cjs': parseModule,
        '.js': parseModule,
        '.ts': parseModule,
    };

    const parser = parsers[extname(path)];
    if (parser === undefined) throw new Error(`${path}: no generated-file parser is declared.`);
    parser(text, path);
}

/** Read the rule table ESLint calculates for each file in a scoped repository. */
export async function readEslintRules(
    eslint: ESLint,
    files: readonly string[],
): Promise<Record<string, EslintConfiguration['rules']>> {
    return Object.fromEntries(
        await Promise.all(
            files.map(async (file) => {
                const configuration = (await eslint.calculateConfigForFile(file)) as EslintConfiguration;
                return [file, configuration.rules] as const;
            }),
        ),
    );
}

/** List each rule name once, sorted. */
export function listFindingRules(findings: readonly LintFinding[]): (string | null)[] {
    return [...new Set(findings.map(({ rule }) => rule))].toSorted((left, right) =>
        (left ?? '').localeCompare(right ?? ''),
    );
}

/** List the findings each source sample expects at this level, in report order. */
export function listScriptFindings(cases: readonly ScriptFindingCase[], level: Level): LintFinding[] {
    return cases
        .flatMap((entry) =>
            [...entry.recommended, ...(level === 'all' ? (entry.all ?? []) : [])].map(({ ruleId, line }) => ({
                file: entry.file,
                rule: ruleId,
                line,
            })),
        )
        .toSorted(compareFindings);
}

/** Read each generated tool file matched by a repository-relative glob. */
export async function readGeneratedFiles(root: string, pattern: string): Promise<{ path: string; content: string }[]> {
    return Promise.all(
        [...new Bun.Glob(pattern).scanSync({ cwd: root, dot: true })].map(async (path) => ({
            path: convertToPosixPath(path),
            content: await readFile(join(root, path), 'utf8'),
        })),
    );
}
