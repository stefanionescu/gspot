// The project file against the tree: test plans, sources in no target, references to files that are gone, and symlinks.
import { scopeOf } from '#cli/repository/scopes.ts';
import { gitBlobs, gitEntries } from '#cli/repository/snapshot.ts';
import type { TestPlan } from '#types/apple.ts';
import type { EngineInput } from '#types/run.ts';
import type { Finding } from '#types/finding.ts';
import { textOf, trackedEnding, xcodeFinding } from '#cli/checks/xcode/files.ts';

const PROJECT_FILE = '.xcodeproj/project.pbxproj';
const TEST_PRODUCT = /productType = "com\.apple\.product-type\.bundle\.(?:unit-test|ui-testing)"/u;
const TARGET_NAME = /\bname = (?<name>"[^"]+"|[\w.-]+);/u;
const SWIFT_REFERENCE = /path = (?<path>"[^"]+\.swift"|[\w./+-]+\.swift);/gu;
const SYNCED_MARK = 'isa = PBXFileSystemSynchronizedRootGroup;';
const FOLDER_PATH = /path = (?<path>"[^"]+"|[\w./+-]+);/u;
const SYMLINK_MODE = '120000';

function unquoted(text: string): string {
    return text.replaceAll('"', '');
}

// The folder that holds the project bundle, with its trailing slash, or an empty string at the root.
function folderOf(projectFile: string): string {
    const bundle = projectFile.slice(0, projectFile.indexOf('.xcodeproj'));
    return bundle.slice(0, bundle.lastIndexOf('/') + 1);
}

// The folders Xcode reads whole: each block of a synchronized group names one.
function syncedFolders(project: string): string[] {
    return project
        .split(SYNCED_MARK)
        .slice(1)
        .flatMap((block) => {
            const found = FOLDER_PATH.exec(block.slice(0, block.indexOf('}')))?.groups?.['path'];
            return found === undefined ? [] : [unquoted(found)];
        });
}

function baseName(path: string): string {
    return path.slice(path.lastIndexOf('/') + 1);
}

// The names of the test targets: each target block that builds a test bundle.
function testTargets(project: string): string[] {
    return project
        .split('isa = PBXNativeTarget;')
        .slice(1)
        .map((block) => block.slice(0, block.indexOf('};')))
        .filter((block) => TEST_PRODUCT.test(block))
        .flatMap((block) => {
            const name = TARGET_NAME.exec(block)?.groups?.['name'];
            return name === undefined ? [] : [unquoted(name)];
        });
}

function projectFindings(input: EngineInput, path: string): Finding[] {
    const project = textOf(input, path);
    const folder = folderOf(path);
    const referenced = new Set(
        project.matchAll(SWIFT_REFERENCE).map((match) => baseName(unquoted(match.groups?.['path'] ?? ''))),
    );
    const synced = syncedFolders(project).map((name) => `${folder}${name}/`);
    const tree = trackedEnding(input, ['.swift']).filter(
        (file) => file.startsWith(folder) && baseName(file) !== 'Package.swift',
    );
    const inTree = new Set(tree.map((file) => baseName(file)));
    const untargeted = tree
        .filter((file) => !referenced.has(baseName(file)) && synced.every((prefix) => !file.startsWith(prefix)))
        .map((file) =>
            xcodeFinding(input, { file, line: 1 }, 'no-target', 'This Swift file is in no target of the project.'),
        );
    const gone = [...referenced]
        .filter((name) => !inTree.has(name))
        .map((name) =>
            xcodeFinding(
                input,
                { file: path, line: 1 },
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
export function testPlans(input: EngineInput): Promise<Finding[]> {
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
        testTargets(textOf(input, path))
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
    return Promise.resolve([...schemes, ...targets]);
}

/**
 * The Swift files in the tree and in no target, and the files a target names that the tree does not hold.
 * @param input the engine input
 * @returns the findings
 */
export function orphanSources(input: EngineInput): Promise<Finding[]> {
    return Promise.resolve(trackedEnding(input, [PROJECT_FILE]).flatMap((path) => projectFindings(input, path)));
}

/**
 * One finding for each tracked symlink beside or under a project, with where it points.
 * @param input the engine input
 * @returns the findings
 */
export async function projectSymlinks(input: EngineInput): Promise<Finding[]> {
    const folders = trackedEnding(input, [PROJECT_FILE]).map((path) => folderOf(path));
    if (folders.length === 0 || !input.session.repository.hasGit) return [];
    const entries = await gitEntries(input.root, { kind: 'index' }, input.session.cancelSignal);
    const links = entries.filter(
        (entry) =>
            entry.mode === SYMLINK_MODE &&
            scopeOf(entry.path, input.session.repository.scopes).path === input.scope &&
            folders.some((folder) => entry.path.startsWith(folder)),
    );
    const targets = await gitBlobs(
        input.root,
        links.map((entry) => entry.object),
        input.session.cancelSignal,
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
