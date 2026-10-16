// Reads generated tool configurations and ESLint findings for tests.
import ts from 'typescript';
import { ESLint } from 'eslint';
import { parse as parseIni } from 'ini';
import { parse as parseYaml } from 'yaml';
import { openSession } from '#cli/session.ts';
import { testdir, createFileTree } from 'testdirs';
import { join, extname, relative } from 'node:path';
import { runGspot } from '#tests/setup/run-gspot.ts';
import type { Session } from '#cli/types/planning.ts';
import { generate } from '#cli/generation/generate.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import type { Level } from '#cli/types/configurations.ts';
import { parse as parseToml } from '@decimalturn/toml-patch';
import { extractToolFileName } from '#cli/planning/files.ts';
import { buildScopeTarget } from '#cli/repository/scopes.ts';
import { linkInstalledModules } from '#tests/setup/modules.ts';
import type { ScopeSelection } from '#cli/types/settings/values.ts';
import { type ParseError, parse as parseJsonc } from 'jsonc-parser';
import type { LintFinding, ScriptFindingCase, EslintConfiguration } from '#tests/types/tool-output.ts';

/** Native ESLint messages limited to the rules a retained test checks. */
async function collectLintFindings(
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

// What sandbox settings generate: the files its selected configurations write, and the ESLint instance its
// configuration produces.

/**
 * Links installed test packages, writes outputs through the managed lifecycle, and loads the ESLint configuration.
 * @param sandboxRoot the sandbox with its gspot.toml.
 * @returns ESLint reading the generated configuration.
 */
async function createEslint(sandboxRoot: string, options?: ESLint.Options): Promise<ESLint> {
    await linkInstalledModules(join(sandboxRoot, 'node_modules'));
    const result = await runGspot(sandboxRoot, ['apply']);
    if (result.code !== 0) throw new Error(result.stdout + result.stderr);
    const session = await openSession(sandboxRoot);
    const selection = session.scopes.find((selection) =>
        selection.selected.some((manifest) =>
            manifest.toolFiles.some((file) => !file.fragment && extractToolFileName(file.target) === 'eslint'),
        ),
    ) as ScopeSelection;
    const scope = selection.scope.path;
    return new ESLint({
        ...options,
        cwd: sandboxRoot,
        overrideConfigFile: join(sandboxRoot, toolFileFor(session, 'eslint', scope)),
        overrideConfig: { languageOptions: { parserOptions: { noWarnOnMultipleProjects: true } } },
    });
}

/**
 * Creates a repository with the settings and files, and returns the content of one generated file.
 * @param settings the gspot.toml text.
 * @param path the generated path to read.
 * @param files further files the repository holds.
 * @returns the generated content.
 */
async function generateFile(settings: string, path: string, files: Record<string, string>): Promise<string> {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { ...files, 'gspot.toml': settings });
    const session = await openSession(sandbox.path);
    const output = generate(session);
    const file = output.files.find((entry) => entry.path === path);
    if (file === undefined) throw new Error(`The sandbox generates no ${path}.`);
    return file.content;
}

/** Compare native findings by file, line, and rule for stable assertions. */
function compareFindings(left: LintFinding, right: LintFinding): number {
    return (
        left.file.localeCompare(right.file) ||
        left.line - right.line ||
        (left.rule ?? '').localeCompare(right.rule ?? '')
    );
}
/** Find the generated file selected for a tool and scope. */
function toolFileFor(session: Session, tool: string, scope = ''): string {
    const declaration = session.scopes
        .find((selection) => selection.scope.path === scope)
        ?.selected.flatMap((manifest) => manifest.toolFiles)
        .find((file) => !file.fragment && extractToolFileName(file.target) === tool);
    if (declaration === undefined) throw new Error(`The sandbox generates no ${tool} file for ${scope || 'the root'}.`);
    return buildScopeTarget(scope, declaration, session.toolFiles().targets);
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

/** Parse a generated tool file with its native syntax reader. */
function parseToolFile(text: string, path: string): void {
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

export { toolFileFor, createEslint, generateFile, parseToolFile, compareFindings, collectLintFindings };

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

/** List distinct native rule names in stable order for level-specific assertions. */
export function listFindingRules(findings: readonly LintFinding[]): (string | null)[] {
    return [...new Set(findings.map(({ rule }) => rule))].toSorted((left, right) =>
        (left ?? '').localeCompare(right ?? ''),
    );
}

/** Project each source sample's level-specific native findings into report order. */
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
