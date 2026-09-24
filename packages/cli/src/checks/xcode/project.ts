// The project file against the tree: test plans, sources in no target, references to files that are gone, and symlinks.
import { posix } from 'node:path';
import { scopeOf } from '#cli/repository/scopes.ts';
import type { Finding } from '#cli/types/reports.ts';
import type { EngineInput } from '#cli/types/execution.ts';
import type { TestPlan } from '#cli/checks/xcode/types.ts';
import { gitBlobs, gitEntries } from '#cli/repository/snapshot.ts';
import { textOf, trackedEnding, xcodeFinding } from '#cli/checks/xcode/files.ts';
import { projectTestTargets, readProject } from '#cli/checks/xcode/project-reader.ts';

const PROJECT_FILE = '.xcodeproj/project.pbxproj';
const SYMLINK_MODE = '120000';

// The folder that holds the project bundle, with its trailing slash, or an empty string at the root.
function folderOf(projectFile: string): string {
    const bundle = projectFile.slice(0, projectFile.indexOf('.xcodeproj'));
    return bundle.slice(0, bundle.lastIndexOf('/') + 1);
}

/**
 *
 * @param input
 */
export function orphanSources(input: EngineInput): Finding[] {
    const projects = trackedEnding(input, [PROJECT_FILE]).map((path) => ({
        path,
        ...readProject(textOf(input, path), posix.join(input.root, folderOf(path))),
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
    const tree = trackedEnding(input, ['.swift']).filter((file) => posix.basename(file) !== 'Package.swift');
    const inTree = new Set(tree);
    const untargeted = tree
        .filter(
            (file) =>
                !referenced.has(file) &&
                synced.every(({ prefix, excluded }) => !file.startsWith(prefix) || excluded.has(file)),
        )
        .map((file) =>
            xcodeFinding(input, { file, line: 1 }, 'no-target', 'This Swift file is in no target of the project.'),
        );
    const gone = references
        .filter(({ path }) => !inTree.has(path))
        .map(({ path: name, project }) =>
            xcodeFinding(
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
    const plans = trackedEnding(input, ['.xctestplan']).map((path) => JSON.parse(textOf(input, path)) as TestPlan);
    const planned = new Set(plans.flatMap((plan) => (plan.testTargets ?? []).map((entry) => entry.target?.name ?? '')));
    const schemes = trackedEnding(input, ['.xcscheme'])
        .filter((path) => path.includes('/xcshareddata/'))
        .filter((path) => {
            const text = textOf(input, path);
            return text.includes('<TestableReference') && !text.includes('<TestPlanReference');
        })
        .map((path) =>
            xcodeFinding(
                input,
                { file: path, line: 1 },
                'scheme-plan',
                'This scheme runs tests and names no test plan.',
            ),
        );
    const targets = trackedEnding(input, [PROJECT_FILE]).flatMap((path) =>
        projectTestTargets(textOf(input, path))
            .filter((name) => !planned.has(name))
            .map((name) =>
                xcodeFinding(
                    input,
                    { file: path, line: 1 },
                    'target-plan',
                    `The test target ${name} is in no test plan.`,
                ),
            ),
    );
    return [...schemes, ...targets];
}

/**
 * One finding for each tracked symlink beside or under a project, with where it points.
 * @param input the engine input
 * @returns the findings
 */
export async function projectSymlinks(input: EngineInput): Promise<Finding[]> {
    const folders = trackedEnding(input, [PROJECT_FILE]).map((path) => folderOf(path));
    if (folders.length === 0 || !input.hasGit) return [];
    const entries = await gitEntries(input.root, { kind: 'index' }, input.cancelSignal, input.observations);
    const links = entries.filter(
        (entry) =>
            entry.mode === SYMLINK_MODE &&
            scopeOf(entry.path, input.scopeEntries).path === input.scope &&
            folders.some((folder) => entry.path.startsWith(folder)),
    );
    const targets = await gitBlobs(
        input.root,
        links.map((entry) => entry.object),
        input.cancelSignal,
    );
    return links.map((entry) => {
        const target = targets.get(entry.object);
        if (target === undefined) throw new Error('A requested Git blob was not returned.');
        return xcodeFinding(
            input,
            { file: entry.path, line: 1 },
            'symlink',
            `A symlink to ${target.toString('utf8')}; Xcode and the checks each follow it their own way.`,
        );
    });
}
