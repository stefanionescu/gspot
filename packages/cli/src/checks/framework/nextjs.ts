// Reads literal Next.js build flags from package-script command syntax.
import ts from 'typescript';
import { join, posix } from 'node:path';
import { readJson } from '#cli/parsers/json.ts';
import { stripVTControlCharacters } from 'node:util';
import { joinScope } from '#cli/repository/scopes.ts';
import { checkInput } from '#cli/execution/built-in.ts';
import { allChecks } from '#cli/configurations/manifests.ts';
import { typescriptNodes } from '#cli/parsers/typescript.ts';
import { runCheckTool } from '#cli/execution/command/tool.ts';
import { findingAt, sourcePaths } from '#cli/checks/finding.ts';
import { toolDeclaration } from '#cli/configurations/tool-pins.ts';
import { packageJsonSchema } from '#cli/parsers/dependency-files.ts';
import { NPM_CLIENTS } from '#cli/config/parsers/dependency-files.ts';
import { readSource, createReadCache } from '#cli/system/file-reads.ts';
import { type Session, type PlannedCheck } from '#cli/types/planning.ts';
import { checkCopyInputs, copyIntoScratch } from '#cli/execution/copy/scratch.ts';
import { runTsc, restoreCommandPaths } from '#cli/checks/language/typescript/project.ts';
import { TSC_TOOL, TYPESCRIPT_TSC_CHECK } from '#cli/config/checks/language/typescript.ts';
import { type Finding, type CheckInput, type CheckResult } from '#cli/types/execution/check.ts';
import { parseShell, type ShellLine, type CommandLine, type CommandChain } from '@yarnpkg/parsers';

import {
    APP_FOLDER,
    CAUSE_MARKS,
    NEXT_CONFIG,
    SECRET_NAME,
    SHOWN_LINES,
    MARKED_LINES,
    NEXT_COMMAND,
    SEGMENT_NAME,
    CI_ENVIRONMENT,
    NEXT_RUN_WORDS,
    DISABLED_CHECKS,
    NEXT_BUILD_ACTION,
    NEXT_BUILD_COMMAND,
    NEXT_PACKAGE_RUNNERS,
    NEXT_TYPEGEN_COMMAND,
} from '#cli/config/checks/framework/nextjs.ts';

function* commandSteps(command: CommandChain): Generator<Extract<CommandChain, { type: 'command' }>> {
    switch (command.type) {
        case 'command': {
            yield command;
            break;
        }
        case 'group': {
            yield* scriptCommands(command.group);
            break;
        }
        case 'subshell': {
            yield* scriptCommands(command.subshell);
            break;
        }
        case 'envs': {
            break;
        }
    }
    if (command.then !== undefined) yield* commandSteps(command.then.chain);
}

// Visit command lines, nested groups, and subshells in shell order.
function* scriptCommands(lines: ShellLine): Generator<Extract<CommandChain, { type: 'command' }>> {
    for (const { command: first } of lines)
        for (let line: CommandLine | undefined = first; line !== undefined; line = line.then?.line)
            yield* commandSteps(line.chain);
}

function nextArguments(
    command: Extract<CommandChain, { type: 'command' }>,
    diagnostic: string,
): (string | undefined)[] {
    const [executable, ...words] = command.args
        .filter((argument) => argument.type === 'argument')
        .map((argument) =>
            argument.segments.every((segment) => segment.type === 'text')
                ? argument.segments.map((segment) => segment.text).join('')
                : undefined,
        );
    if (executable === undefined) throw new Error(diagnostic);
    if (executable === NEXT_COMMAND) return words;
    const wrapped =
        new Set<string | undefined>(NEXT_PACKAGE_RUNNERS).has(executable) ||
        (new Set<string | undefined>(NPM_CLIENTS).has(executable) &&
            new Set<string | undefined>(NEXT_RUN_WORDS).has(words[0] ?? ''));
    if (!wrapped) return [];
    const at = words.indexOf(NEXT_COMMAND);
    return at === -1 ? [] : words.slice(at + 1);
}

// Next.js puts the cause and its detail above the longer stack trace.
function failureSummary(text: string): string {
    const lines = stripVTControlCharacters(text).trim().split('\n');
    const marked = lines.findIndex((line) => CAUSE_MARKS.some((mark) => line.includes(mark)));
    const shown = marked === -1 ? lines.slice(-SHOWN_LINES) : lines.slice(marked, marked + MARKED_LINES);
    return shown.join(' ').trim();
}

// Names with runtime values cannot establish a configuration option.
function propertyName(name: ts.PropertyName): string | undefined {
    if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text;
    if (ts.isComputedPropertyName(name) && ts.isStringLiteral(name.expression)) return name.expression.text;
    return undefined;
}

// Assertions and parentheses keep the literal's runtime value.
function literalValue(value: ts.Expression): ts.Expression {
    let expression = value;
    while (
        ts.isParenthesizedExpression(expression) ||
        ts.isAsExpression(expression) ||
        ts.isTypeAssertionExpression(expression) ||
        ts.isSatisfiesExpression(expression)
    )
        expression = expression.expression;
    return expression;
}

/**
 * Read literal options without treating comments, strings, or nested env values as property names.
 * @param input the selected check and repository files.
 * @param path the tool file name.
 * @param text the source text.
 * @returns disabled checks and likely secret keys with one-based source lines.
 */
function nextSettingsFindings(input: Pick<CheckInput, 'check'>, path: string, text: string): Finding[] {
    const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
    return typescriptNodes(source)
        .filter((node) => ts.isPropertyAssignment(node))
        .flatMap((node): Finding[] => {
            const name = propertyName(node.name);
            if (name === undefined) return [];
            const value = literalValue(node.initializer);
            if (DISABLED_CHECKS.has(name) && value.kind === ts.SyntaxKind.TrueKeyword)
                return [
                    findingAt(
                        input,
                        { file: path, line: source.getLineAndCharacterOfPosition(node.name.getStart(source)).line + 1 },
                        'checks-off',
                        `${name}: true lets next build pass with errors. Remove it.`,
                    ),
                ];
            if (name !== 'env' || !ts.isObjectLiteralExpression(value)) return [];
            return value.properties
                .filter((property) => ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property))
                .flatMap((property): Finding[] => {
                    const key = propertyName(property.name);
                    if (key === undefined || !SECRET_NAME.test(key)) return [];
                    return [
                        findingAt(
                            input,
                            {
                                file: path,
                                line: source.getLineAndCharacterOfPosition(property.name.getStart(source)).line + 1,
                            },
                            'env-secret',
                            `${key} under env is written into the client bundle. Read it on the server.`,
                        ),
                    ];
                });
        });
}

/**
 * Read Next.js build flags from a package script without executing its shell commands.
 * @param source the package build script.
 * @returns the literal flags of its Next.js build command.
 */
export function parseNextBuildFlags(source: string): string[] {
    const diagnostic =
        'The Next.js build script has unresolved command or flag expansions. Use literal Next.js build arguments.';
    for (const command of scriptCommands(parseShell(source, { isGlobPattern: () => false }))) {
        const [action, ...flags] = nextArguments(command, diagnostic);
        if (action !== NEXT_BUILD_ACTION) continue;
        return flags.map((value) => {
            if (value === undefined) throw new Error(diagnostic);
            return value;
        });
    }
    return [];
}

/**
 * One finding for each route segment that holds a page and a route handler.
 * @param input the check input.
 * @returns the findings.
 */
export function nextjsRouteSegments(input: CheckInput): Finding[] {
    const kinds = new Map<string, Map<string, string>>();
    for (const path of sourcePaths(input)) {
        const groups = SEGMENT_NAME.exec(posix.basename(path))?.groups;
        if (groups === undefined || !`/${path}`.includes(APP_FOLDER)) continue;
        const folder = path.slice(0, path.lastIndexOf('/'));
        const held = kinds.get(folder) ?? new Map<string, string>();
        held.set(groups['kind'] ?? '', path);
        kinds.set(folder, held);
    }
    return kinds
        .entries()
        .filter(([, held]) => held.has('page') && held.has('route'))
        .map(([folder, held]) =>
            findingAt(
                input,
                { file: held.get('route') ?? folder, line: 1 },
                'route-segment',
                `${folder} holds both a page and a route handler, and next build refuses that. Move the route handler into its own segment.`,
            ),
        )
        .toArray();
}

/**
 * Reports each next.config option that disables a build check, and each secret-looking key under env.
 * @param input the check input.
 * @returns the findings.
 */
export function nextConfig(input: CheckInput): Finding[] {
    return sourcePaths(input)
        .filter((path) => NEXT_CONFIG.test(path))
        .flatMap((path) => {
            const text = readSource(input.root, path, input.reads).toString('utf8');
            return nextSettingsFindings(input, path, text);
        });
}

/**
 * Generate Next.js route types and run the shared TypeScript check in the same scratch copy.
 * @param session the repository and tool session.
 * @param planned the Next.js compiler check.
 * @returns the compiler findings and execution status.
 */
export async function nextjsTsc(session: Session, planned: PlannedCheck): Promise<CheckResult> {
    const started = performance.now();
    using scratchFolder = await copyIntoScratch(checkCopyInputs(checkInput(session, planned)));
    const root = scratchFolder.path;
    const scratchSession = { ...session, root, reads: createReadCache(root) };
    // CI prevents package installation; generated Next.js files stay in the compiler's scratch project.
    const generated = await runCheckTool(checkInput(scratchSession, planned), NEXT_TYPEGEN_COMMAND, {
        cwd: join(root, planned.scope.scope.path),
        env: CI_ENVIRONMENT,
    });
    const output = `${generated.stdout}${generated.stderr}`;
    if (generated.code !== 0) throw new Error(`The next typegen command failed: ${failureSummary(output)}`);
    const compiler = allChecks(session.manifests.values()).get(TYPESCRIPT_TSC_CHECK);
    if (compiler === undefined) throw new Error('The Next.js compiler check requires typescript/tsc.');
    const result = await runTsc(
        scratchSession,
        {
            ...planned,
            check: { ...compiler.check, ...planned.check, output: compiler.check.output },
            tool: toolDeclaration(session.manifests.values(), TSC_TOOL, compiler.configuration),
        },
        root,
    );
    result.duration = performance.now() - started;
    return restoreCommandPaths(result, root, session.root);
}

/**
 * Builds the selected Next.js app in a scratch copy.
 * @param input the check input.
 * @returns one finding for a build that fails.
 */
export async function nextjsBuild(input: CheckInput): Promise<Finding[]> {
    using scratchFolder = await copyIntoScratch(checkCopyInputs(input));
    const scratch = scratchFolder.path;
    const scratchInput = { ...input, root: scratch, installedRoot: scratch };
    const cwd = join(scratchInput.root, scratchInput.selection.scope.path);
    const manifest = readJson(
        joinScope(input.selection.scope.path, 'package.json'),
        readSource(input.root, joinScope(input.selection.scope.path, 'package.json'), input.reads).toString('utf8'),
        packageJsonSchema,
    );
    const flags = parseNextBuildFlags(manifest.scripts?.['build'] ?? NEXT_BUILD_COMMAND.join(' '));
    const command = [...NEXT_BUILD_COMMAND, ...flags];
    const result = await runCheckTool(scratchInput, command, { cwd, env: CI_ENVIRONMENT });
    if (result.code === 0) return [];
    const output = failureSummary(`${result.stdout}${result.stderr}`);
    return [
        findingAt(
            input,
            { file: joinScope(input.selection.scope.path, 'package.json'), line: 1 },
            'build',
            `next build failed: ${output}`,
        ),
    ];
}
