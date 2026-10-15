import { z } from 'zod';
import { posix } from 'node:path';
import { PBXPROJ } from '#cli/config/parsers/xcode.ts';
import { readSource } from '#cli/system/file-reads.ts';
import { parseIndexRevision } from '#cli/parsers/git.ts';
import { parseJsonDocument } from '#cli/parsers/json.ts';
import type { SchemaShape } from '#cli/types/objects.ts';
import { SWIFT_EXTENSION } from '#cli/config/parsers/swift.ts';
import { findingAt, sourcePaths } from '#cli/checks/finding.ts';
import { readBlobs } from '#cli/repository/revisions/objects.ts';
import { testTargets, parsePbxproj } from '#cli/parsers/xcode.ts';
import { SYMLINK_MODE } from '#cli/config/repository/revisions.ts';
import { PACKAGE_SWIFT } from '#cli/config/parsers/dependency-files.ts';
import type { Finding, CheckInput } from '#cli/types/execution/check.ts';

import {
    SCHEME_SUFFIX,
    TEST_PLAN_SUFFIX,
    XCODEPROJ_SUFFIX,
    SHARED_DATA_FOLDER,
} from '#cli/config/checks/infrastructure/xcode.ts';

// The folder that holds the project bundle, with its trailing slash, or an empty string at the root.
function projectFolder(projectFile: string): string {
    const bundle = projectFile.slice(0, projectFile.indexOf(XCODEPROJ_SUFFIX));
    return bundle.slice(0, bundle.lastIndexOf('/') + 1);
}
/** The test target membership consumed from an Xcode test plan. */
const testPlanSchema = z.object({
    testTargets: z
        .array(
            z.object({
                target: z
                    .object({ name: z.string().optional() } satisfies SchemaShape<{ name?: string | undefined }>)
                    .optional(),
                skippedTests: z.array(z.string()).optional(),
            } satisfies SchemaShape<{
                target?: { name?: string | undefined } | undefined;
                skippedTests?: string[] | undefined;
            }>),
        )
        .optional(),
} satisfies SchemaShape<{
    testTargets?:
        | { target?: { name?: string | undefined } | undefined; skippedTests?: string[] | undefined }[]
        | undefined;
}>);
/**
 * Report Swift sources outside targets and project references missing from the tree.
 * @param input the check input.
 * @returns the findings.
 */
export function xcodeFilesWithoutTarget(input: CheckInput): Finding[] {
    const projects = sourcePaths(input, [PBXPROJ]).map((path) => ({
        path,
        ...parsePbxproj(readSource(input.root, path, input.reads).toString('utf8'), projectFolder(path)),
    }));
    if (projects.length === 0) return [];
    const references = projects.flatMap((project) =>
        [...project.sources].map((source) => ({
            project: project.path,
            path: source,
        })),
    );
    const referenced = new Set(references.map(({ path }) => path));
    const folders = projects.flatMap((project) => project.folders);
    const tree = sourcePaths(input, [SWIFT_EXTENSION]).filter((file) => posix.basename(file) !== PACKAGE_SWIFT);
    const inTree = new Set(tree);
    const untargeted = tree
        .filter(
            (file) =>
                !referenced.has(file) &&
                folders.every(({ path, excluded }) => !file.startsWith(path) || excluded.has(file)),
        )
        .map((file) =>
            findingAt(input, { file, line: 1 }, 'untargeted', 'This Swift file is in no target of the project.'),
        );
    const gone = references
        .filter(({ path }) => !inTree.has(path))
        .map(({ path: name, project }) =>
            findingAt(
                input,
                { file: project, line: 1 },
                'missing-file',
                `The project names ${name}, and the tree holds no such file.`,
            ),
        );
    return [...untargeted, ...gone];
}
/**
 * Every shared scheme that runs tests names a test plan, and some plan includes every test target.
 * @param input the check input.
 * @returns the findings.
 */
export function xcodeTestPlans(input: CheckInput): Finding[] {
    const plans = sourcePaths(input, [TEST_PLAN_SUFFIX]).map((path) => ({
        path,
        read: parseJsonDocument(readSource(input.root, path, input.reads).toString('utf8'), testPlanSchema),
    }));
    const syntax = plans.flatMap(({ path, read }) =>
        'error' in read ? [findingAt(input, { file: path, line: 1 }, 'syntax', read.error)] : [],
    );
    const planned = new Set(
        plans.flatMap(({ read }) =>
            ('value' in read ? (read.value.testTargets ?? []) : []).map((entry) => entry.target?.name ?? ''),
        ),
    );
    const schemes = sourcePaths(input, [SCHEME_SUFFIX])
        .filter((path) => path.includes(SHARED_DATA_FOLDER))
        .filter((path) => {
            const text = readSource(input.root, path, input.reads).toString('utf8');
            return text.includes('<TestableReference') && !text.includes('<TestPlanReference');
        })
        .map((path) =>
            findingAt(input, { file: path, line: 1 }, 'scheme-plan', 'This scheme runs tests and names no test plan.'),
        );
    if (syntax.length > 0) return [...syntax, ...schemes];
    const targets = sourcePaths(input, [PBXPROJ]).flatMap((path) =>
        testTargets(readSource(input.root, path, input.reads).toString('utf8'))
            .filter((name) => !planned.has(name))
            .map((name) =>
                findingAt(input, { file: path, line: 1 }, 'target-plan', `The test target ${name} is in no test plan.`),
            ),
    );
    return [...schemes, ...targets];
}
/**
 * One finding for each tracked symlink beside or under a project, with where it points.
 * @param input the check input.
 * @returns the findings.
 */
export async function xcodeSymlinks(input: CheckInput): Promise<Finding[]> {
    const folders = sourcePaths(input, [PBXPROJ]).map((projectFile) => projectFolder(projectFile));
    if (folders.length === 0) return [];
    const entries = parseIndexRevision(input.index);
    const links = entries.filter(
        (entry) =>
            entry.mode === SYMLINK_MODE &&
            input.files.some((file) => file.path === entry.path) &&
            folders.some((folder) => entry.path.startsWith(folder)),
    );
    const targets = await readBlobs(
        input.root,
        links.map((entry) => entry.hash),
        input.cancelSignal,
    );
    return links.map((entry, index) => {
        const target = targets[index] as Buffer;
        return findingAt(
            input,
            { file: entry.path, line: 1 },
            'symlink',
            `Replace this symlink to ${target.toString('utf8')} with the file it points to.`,
        );
    });
}
