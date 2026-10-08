import { posix } from 'node:path';
import { findingAt } from '#cli/checks/finding.ts';
import { readSource } from '#cli/platform/source.ts';
import { parseIndexRevision } from '#cli/parsers/git.ts';
import { parseJsonDocument } from '#cli/parsers/json.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import { testPlanSchema } from '#cli/parsers/schema/xcode.ts';
import type { CheckInput } from '#cli/types/execution/check.ts';
import { getBlobs } from '#cli/repository/revisions/objects.ts';
import { readPbxproj, testTargets } from '#cli/parsers/xcode.ts';
import { SYMLINK_MODE } from '#cli/config/repository/revisions.ts';
import { XCODE_PROJECT_FILE } from '#cli/config/checks/tool/xcode.ts';

// The folder that holds the project bundle, with its trailing slash, or an empty string at the root.

function projectFolder(projectFile: string): string {
    const bundle = projectFile.slice(0, projectFile.indexOf('.xcodeproj'));
    return bundle.slice(0, bundle.lastIndexOf('/') + 1);
}

/**
 * Report Swift sources outside targets and project references missing from the tree.
 * @param input the check input
 * @returns the findings
 */
export function orphanSources(input: CheckInput): Finding[] {
    const projects = scopeSourcesByEnding(input, [XCODE_PROJECT_FILE]).map((path) => ({
        path,
        ...readPbxproj(readSource(input.root, path, input.reads).toString('utf8'), projectFolder(path)),
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
    const tree = scopeSourcesByEnding(input, ['.swift']).filter((file) => posix.basename(file) !== 'Package.swift');
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
 * Every shared scheme that runs tests names a test plan, and every test target is in some plan.
 * @param input the check input
 * @returns the findings
 */
export function testPlans(input: CheckInput): Finding[] {
    const plans = scopeSourcesByEnding(input, ['.xctestplan']).map((path) => ({
        path,
        read: parseJsonDocument(readSource(input.root, path, input.reads).toString('utf8'), testPlanSchema),
    }));
    const syntax = plans.flatMap(({ path, read }) =>
        read.error === undefined ? [] : [findingAt(input, { file: path, line: 1 }, 'syntax', read.error)],
    );
    const planned = new Set(
        plans.flatMap(({ read }) => (read.data?.testTargets ?? []).map((entry) => entry.target?.name ?? '')),
    );
    const schemes = scopeSourcesByEnding(input, ['.xcscheme'])
        .filter((path) => path.includes('/xcshareddata/'))
        .filter((path) => {
            const text = readSource(input.root, path, input.reads).toString('utf8');
            return text.includes('<TestableReference') && !text.includes('<TestPlanReference');
        })
        .map((path) =>
            findingAt(input, { file: path, line: 1 }, 'scheme-plan', 'This scheme runs tests and names no test plan.'),
        );
    if (syntax.length > 0) return [...syntax, ...schemes];
    const targets = scopeSourcesByEnding(input, [XCODE_PROJECT_FILE]).flatMap((path) =>
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
 * @param input the check input
 * @returns the findings
 */
export async function symlinks(input: CheckInput): Promise<Finding[]> {
    const folders = scopeSourcesByEnding(input, [XCODE_PROJECT_FILE]).map((projectFile) => projectFolder(projectFile));
    if (folders.length === 0 || !input.hasGit) return [];
    const entries = parseIndexRevision(input.index);
    const links = entries.filter(
        (entry) =>
            entry.mode === SYMLINK_MODE &&
            input.files.some((file) => file.path === entry.path) &&
            folders.some((folder) => entry.path.startsWith(folder)),
    );
    const targets = await getBlobs(
        input.root,
        links.map((entry) => entry.hash),
        input.cancelSignal,
    );
    return links.map((entry) => {
        const target = targets.get(entry.hash);
        if (target === undefined) throw new Error('A requested Git blob was not returned.');
        return findingAt(
            input,
            { file: entry.path, line: 1 },
            'symlink',
            `A symlink to ${target.toString('utf8')}; Xcode and the checks each follow it their own way.`,
        );
    });
}

/**
 * The tracked source files whose path ends one of the given ways.
 * @param input the check input
 * @param endings the path endings
 * @returns the paths
 */
export function scopeSourcesByEnding(input: CheckInput, endings: string[]): string[] {
    return input.files
        .filter((file) => file.kind === 'source' && endings.some((ending) => file.path.endsWith(ending)))
        .map((file) => file.path);
}
