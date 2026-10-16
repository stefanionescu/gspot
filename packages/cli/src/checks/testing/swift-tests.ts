import { z } from 'zod';
import { realpathSync } from 'node:fs';
import { posix, resolve } from 'node:path';
import type { Node } from 'web-tree-sitter';
import { findingAt } from '#cli/checks/finding.ts';
import { FULL_PERCENTAGE } from '#cli/config/units.ts';
import type { SchemaShape } from '#cli/types/objects.ts';
import { visitParsedSources } from '#cli/parsers/tree-sitter.ts';
// eslint-disable-next-line import-x/no-cycle -- reason: These declarations call each other only after both modules initialize; final placement keeps their separate topics.
import { measureCoverage } from '#cli/checks/testing/coverage.ts';
import type { CoverageReport } from '#cli/types/checks/testing.ts';
import type { TableSettings } from '#cli/types/settings/tables.ts';
import { PACKAGE_SWIFT } from '#cli/config/parsers/dependency-files.ts';
import type { Finding, CheckInput } from '#cli/types/execution/check.ts';

import {
    COMMENT_LINE,
    XCTEST_PREFIX,
    TEST_TARGET_TYPE,
    APP_TARGET_SUFFIX,
    SWIFT_TARGET_MODULE,
    SKIP_REASON_ARGUMENT,
    SWIFT_STRING_LITERAL,
} from '#cli/config/checks/testing.ts';

function hasReason(value: Node | undefined): boolean {
    if (value === undefined || value.text === 'nil') return false;
    if (!value.type.endsWith('string_literal')) return true;
    const literal = SWIFT_STRING_LITERAL.exec(value.text);
    if (literal === null) return true;
    const whitespace = new RegExp(`\\\\${literal[1] ?? ''}[nrt0]`, 'gu');
    return (literal[3] ?? '').replaceAll(whitespace, ' ').trim() !== '';
}
function skipReason(call: Node, position: number): Node | undefined {
    const argumentsNode = call.namedChildren
        .find((node) => node.type === 'call_suffix')
        ?.namedChildren.find((node) => node.type === 'value_arguments');
    const positional =
        argumentsNode?.namedChildren.filter(
            (node) => node.type === 'value_argument' && node.childForFieldName('name') === null,
        ) ?? [];
    return positional[position]?.childForFieldName('value') ?? undefined;
}
function disabledNodes(root: Node, lines: string[]): Node[] {
    const calls = root.descendantsOfType('call_expression').filter((call) => {
        const name = call.firstNamedChild?.text.replace(XCTEST_PREFIX, '') ?? '';
        const position = SKIP_REASON_ARGUMENT.get(name);
        if (position === undefined) return false;
        return !hasReason(skipReason(call, position));
    });
    const attributes = root.descendantsOfType('attribute').filter((attribute) => {
        if (
            attribute.firstNamedChild?.text !== 'available' ||
            !attribute.namedChildren.some((node) => node.type === 'simple_identifier' && node.text === 'unavailable')
        )
            return false;
        const reasonArgument =
            attribute.namedChildren.find((node) => node.text === 'message')?.nextNamedSibling ?? undefined;
        return !hasReason(reasonArgument) && !COMMENT_LINE.test(lines[attribute.startPosition.row - 1] ?? '');
    });
    return [...calls, ...attributes];
}
/** The source targets and exact source paths reported by Swift Package Manager. */
const swiftPackageCoverageSchema = z.object({
    targets: z.array(
        z.object({
            name: z.string().min(1),
            path: z.string(),
            type: z.string(),
            module_type: z.string(),
            sources: z.array(z.string()),
        } satisfies SchemaShape<{ name: string; path: string; type: string; module_type: string; sources: string[] }>),
    ),
} satisfies SchemaShape<{
    targets: { name: string; path: string; type: string; module_type: string; sources: string[] }[];
}>);
/** Native compiler coverage export with source line counts. */
const swiftCoverageSchema = z.object({
    data: z.array(
        z.object({
            files: z.array(
                z.object({
                    filename: z.string(),
                    summary: z.object({
                        lines: z.object({
                            count: z.number().int().nonnegative(),
                            covered: z.number().int().nonnegative(),
                        } satisfies SchemaShape<{ count: number; covered: number }>),
                    } satisfies SchemaShape<{ lines: { count: number; covered: number } }>),
                } satisfies SchemaShape<{ filename: string; summary: { lines: { count: number; covered: number } } }>),
            ),
        } satisfies SchemaShape<{
            files: { filename: string; summary: { lines: { count: number; covered: number } } }[];
        }>),
    ),
} satisfies SchemaShape<{
    data: { files: { filename: string; summary: { lines: { count: number; covered: number } } }[] }[];
}>);
/**
 * One finding for each skipped test without a reason argument or unavailable declaration without an explanation.
 * @param input the check input.
 * @returns the findings.
 */
export async function swiftTestsSkipReasons(input: CheckInput): Promise<Finding[]> {
    const files = input.files.map((file) => ({ path: file.path, grammar: 'swift' as const }));
    const findings: Finding[] = [];
    await visitParsedSources({ ...input, files }, (source) => {
        for (const node of disabledNodes(source.rootNode, source.text.split('\n')))
            findings.push(
                findingAt(
                    input,
                    { file: source.path, line: node.startPosition.row + 1 },
                    'disabled',
                    'Explain why this test is disabled in its reason argument or availability annotation.',
                ),
            );
    });
    return findings;
}
/**
 * The targets under their limit.
 * @param report what xccov printed.
 * @param settings the common limit and target overrides of the settings.
 * @returns one line of text for each target under its limit, or missing from the report.
 */
export function coverageShortfalls(
    report: CoverageReport,
    settings: Pick<TableSettings<'coverage'>, 'lines' | 'target'>,
): string[] {
    const limits = [
        ...settings.target,
        ...report.targets
            .filter(
                (target) =>
                    !settings.target.some(
                        (limit) => target.name === limit.name || target.name === `${limit.name}${APP_TARGET_SUFFIX}`,
                    ),
            )
            .map((target) => ({ name: target.name, lines: settings.lines })),
    ];
    return limits.flatMap((limit) => {
        const target = report.targets.find(
            (entry) => entry.name === limit.name || entry.name === `${limit.name}${APP_TARGET_SUFFIX}`,
        );
        if (target === undefined) return [`The coverage report has no target named ${limit.name}.`];
        const covered = Math.floor(target.lineCoverage * FULL_PERCENTAGE);
        return covered >= limit.lines
            ? []
            : [`${limit.name} covers ${String(covered)}% of its lines, under the limit of ${String(limit.lines)}%.`];
    });
}
/**
 * Runs the tests with coverage and compares each named target with its limit. Uses the common line limit and explicit target overrides.
 * @param input the check input.
 * @returns the findings.
 */
export async function swiftTestsCoverage(input: CheckInput): Promise<Finding[]> {
    if (input.cancelSignal?.aborted === true) throw new Error('The command was canceled.');
    const settings = input.selection.view.options('coverage');
    const report = await measureCoverage(input);
    return coverageShortfalls(report, settings).map((text) =>
        findingAt(
            input,
            {
                file:
                    input.selection.view.options('xcode').project ??
                    posix.join(input.selection.scope.path, PACKAGE_SWIFT),
                line: 1,
            },
            'coverage',
            text,
        ),
    );
}
/**
 * Attribute covered source lines to Swift Package Manager's actual target declarations.
 * @param text compiler coverage report at the reported Swift path.
 * @param packageText the package description, including custom target paths.
 * @param folder the selected package folder in the source copy.
 * @returns source target coverage without test targets or derived runner sources.
 */
export function parseSwiftCoverage(text: string, packageText: string, folder: string): CoverageReport {
    const report = swiftCoverageSchema.parse(JSON.parse(text));
    const description = swiftPackageCoverageSchema.parse(JSON.parse(packageText));
    const root = realpathSync(folder);
    const measured = new Map(
        report.data.flatMap((data) => data.files).map((file) => [file.filename, file.summary.lines]),
    );
    return {
        targets: description.targets
            .filter((target) => target.type !== TEST_TARGET_TYPE && target.module_type === SWIFT_TARGET_MODULE)
            .flatMap((target) => {
                const lines = target.sources.flatMap((source) => {
                    const file = measured.get(resolve(root, target.path, source));
                    return file === undefined ? [] : [file];
                });
                if (lines.length === 0)
                    throw new Error(`The Swift coverage report has no source lines for target ${target.name}.`);
                const count = lines.reduce((total, entry) => total + entry.count, 0);
                const covered = lines.reduce((total, entry) => total + entry.covered, 0);
                return [{ name: target.name, lineCoverage: count === 0 ? 1 : covered / count }];
            }),
    };
}
export const xccovSchema = z.object({
    targets: z.array(
        z.object({ name: z.string().min(1), lineCoverage: z.number().min(0).max(1) } satisfies SchemaShape<
            CoverageReport['targets'][number]
        >),
    ),
} satisfies SchemaShape<CoverageReport>);
