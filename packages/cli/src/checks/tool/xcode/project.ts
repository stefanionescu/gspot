import { posix } from 'node:path';
import { scopeOf } from '#cli/repository/scopes.ts';
import { readSource } from '#cli/platform/source.ts';
import { findingAt } from '#cli/execution/finding.ts';
import { parseJsonDocument } from '#cli/parsers/json.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import { testPlanSchema } from '#cli/parsers/schema/xcode.ts';
import type { EngineInput } from '#cli/types/execution/check.ts';
import { readPbxproj, testTargets } from '#cli/parsers/xcode.ts';
import { SYMLINK_MODE } from '#cli/config/repository/revisions.ts';
import { XCODE_PROJECT_FILE } from '#cli/config/checks/tool/xcode.ts';
import { getBlobs, getCachedEntries } from '#cli/repository/revisions/objects.ts';

// The folder that holds the project bundle, with its trailing slash, or an empty string at the root.

function folderOf(projectFile: string): string {
    const bundle = projectFile.slice(0, projectFile.indexOf('.xcodeproj'));
    return bundle.slice(0, bundle.lastIndexOf('/') + 1);
}

/**
 * Report Swift sources outside targets and project references missing from the tree.
 * @param input the engine input
 * @returns the findings
 */
export function orphanSources(input: EngineInput): Finding[] {
    const projects = trackedByExtension(input, [XCODE_PROJECT_FILE]).map((path) => ({
        path,
        ...readPbxproj(
            readSource(input.root, path, input.reads).toString('utf8'),
            posix.join(input.root, folderOf(path)),
        ),
    }));
    if (projects.length === 0) return [];
    const references = projects.flatMap((project) =>
        [...project.sources].map((source) => ({
            project: project.path,
            path: posix.relative(input.root, source),
        })),
    );
    const referenced = new Set(references.map(({ path }) => path));
    const synced = projects
        .flatMap((project) => project.folders)
        .map(({ path, excluded }) => ({
            prefix: `${posix.relative(input.root, path)}/`.replace(/^\//u, ''),
            excluded: new Set([...excluded].map((source) => posix.relative(input.root, source))),
        }));
    const tree = trackedByExtension(input, ['.swift']).filter((file) => posix.basename(file) !== 'Package.swift');
    const inTree = new Set(tree);
    const untargeted = tree
        .filter(
            (file) =>
                !referenced.has(file) &&
                synced.every(({ prefix, excluded }) => !file.startsWith(prefix) || excluded.has(file)),
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
 * @param input the engine input
 * @returns the findings
 */
export function testPlans(input: EngineInput): Finding[] {
    const plans = trackedByExtension(input, ['.xctestplan']).map((path) => ({
        path,
        read: parseJsonDocument(readSource(input.root, path, input.reads).toString('utf8'), testPlanSchema),
    }));
    const syntax = plans.flatMap(({ path, read }) =>
        read.error === undefined ? [] : [findingAt(input, { file: path, line: 1 }, 'syntax', read.error)],
    );
    const planned = new Set(
        plans.flatMap(({ read }) => (read.data?.testTargets ?? []).map((entry) => entry.target?.name ?? '')),
    );
    const schemes = trackedByExtension(input, ['.xcscheme'])
        .filter((path) => path.includes('/xcshareddata/'))
        .filter((path) => {
            const text = readSource(input.root, path, input.reads).toString('utf8');
            return text.includes('<TestableReference') && !text.includes('<TestPlanReference');
        })
        .map((path) =>
            findingAt(input, { file: path, line: 1 }, 'scheme-plan', 'This scheme runs tests and names no test plan.'),
        );
    if (syntax.length > 0) return [...syntax, ...schemes];
    const targets = trackedByExtension(input, [XCODE_PROJECT_FILE]).flatMap((path) =>
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
 * @param input the engine input
 * @returns the findings
 */
export async function symlinks(input: EngineInput): Promise<Finding[]> {
    const folders = trackedByExtension(input, [XCODE_PROJECT_FILE]).map((projectFile) => folderOf(projectFile));
    if (folders.length === 0 || !input.hasGit) return [];
    const entries = await getCachedEntries(input.root, { kind: 'index' }, input.reads, input.cancelSignal);
    const links = entries.filter(
        (entry) =>
            entry.mode === SYMLINK_MODE &&
            scopeOf(entry.path, input.scopeEntries).path === input.scope &&
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
 * @param input the engine input
 * @param endings the path endings
 * @returns the paths
 */
export function trackedByExtension(input: EngineInput, endings: string[]): string[] {
    return input.files
        .filter(
            (file) =>
                file.kind === 'source' &&
                scopeOf(file.path, input.scopeEntries).path === input.scope &&
                endings.some((ending) => file.path.endsWith(ending)),
        )
        .map((file) => file.path);
}
