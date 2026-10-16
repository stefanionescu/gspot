// Check Next.js options and generate its types before type checking.
import ts from 'typescript';
import { join } from 'node:path';
import { stripVTControlCharacters } from 'node:util';
import { checkInput } from '#cli/execution/built-in.ts';
import { allChecks } from '#cli/configurations/manifests.ts';
import { typescriptNodes } from '#cli/parsers/typescript.ts';
import { runCheckTool } from '#cli/execution/command/tool.ts';
import { findingAt, sourcePaths } from '#cli/checks/finding.ts';
import { toolDeclaration } from '#cli/configurations/tool-pins.ts';
import { readSource, createReadCache } from '#cli/system/file-reads.ts';
import { type Session, type PlannedCheck } from '#cli/types/planning.ts';
import { checkCopyInputs, copyIntoScratch } from '#cli/execution/copy/scratch.ts';
import { runTsc, restoreCommandPaths } from '#cli/checks/language/typescript/project.ts';
import { TSC_TOOL, TYPESCRIPT_TSC_CHECK } from '#cli/config/checks/language/typescript.ts';
import { type Finding, type CheckInput, type CheckResult } from '#cli/types/execution/check.ts';

import {
    CAUSE_MARKS,
    NEXT_CONFIG,
    SECRET_NAME,
    SHOWN_LINES,
    MARKED_LINES,
    CI_ENVIRONMENT,
    DISABLED_CHECKS,
    NEXT_TYPEGEN_COMMAND,
} from '#cli/config/checks/framework/nextjs.ts';

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
