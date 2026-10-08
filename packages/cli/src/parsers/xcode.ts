import { posix } from 'node:path';
import { parse } from '@bacons/xcode/json';
import { pbxprojSchema } from '#cli/parsers/schema/xcode.ts';
import { SETTING_REFERENCE } from '#cli/config/parsers/xcode.ts';

import type {
    Folder,
    ProjectEntry,
    XcodeProject,
    ProjectSources,
    ProjectMetadata,
    ProjectBuildSettings,
} from '#cli/types/parsers/xcode.ts';

// The object an id names, which must exist.
function projectItem(project: Pick<XcodeProject, 'objects'>, id: string): ProjectEntry {
    const found = project.objects[id];
    if (found === undefined) throw new Error(`The Xcode project references an unknown object: ${id}.`);
    return found;
}

// The group each object is a child of, refusing an object two groups claim.
function parentGroups(objects: Record<string, ProjectEntry>): Map<string, string> {
    const parents = new Map<string, string>();
    for (const [id, entry] of Object.entries(objects))
        for (const child of entry.children ?? []) {
            if (parents.has(child))
                throw new Error(`The Xcode project gives an object multiple parent groups: ${child}.`);
            parents.set(child, id);
        }
    return parents;
}

// The folder that a group-relative object belongs to: the project folder for the main group, else its parent's.
function groupBase(project: XcodeProject, id: string): string {
    if (id === project.root.mainGroup) return posix.join(project.directory, project.root.projectDirPath ?? '');
    const parent = project.parents.get(id);
    if (parent === undefined) throw new Error(`The Xcode project has no parent group for ${id}.`);
    return projectPath(project, parent);
}

// The folder an object's source tree starts from.
function treeBase(project: XcodeProject, id: string, tree: string): string {
    if (tree === 'SOURCE_ROOT') return project.directory;
    if (tree === '<absolute>') return '/';
    if (tree === '<group>') return groupBase(project, id);
    throw new Error(`Cannot find the folder of Xcode source tree ${tree} without build settings.`);
}

// The repository-relative path of an object, following its groups up to the main group.
function projectPath(project: XcodeProject, id: string): string {
    if (project.visiting.has(id)) throw new Error('The Xcode project contains a group cycle.');
    project.visiting.add(id);
    const entry = projectItem(project, id);
    const base = treeBase(project, id, entry.sourceTree ?? '<group>');
    const path = entry.path ?? '';
    if (SETTING_REFERENCE.test(path)) throw new Error(`Cannot find Xcode source path ${path} without build settings.`);
    project.visiting.delete(id);
    return posix.normalize(posix.isAbsolute(path) ? path : posix.join(base, path));
}

// The Swift files a target compiles, from its sources build phases.
function targetSources(project: XcodeProject, target: ProjectEntry): string[] {
    const phases = (target.buildPhases ?? []).map((phaseId) => projectItem(project, phaseId));
    return phases
        .filter((phase) => phase.isa === 'PBXSourcesBuildPhase')
        .flatMap((phase) => phase.files ?? [])
        .flatMap((buildId) => {
            const build = projectItem(project, buildId);
            if (build.fileRef === undefined) throw new Error('An Xcode source build entry has no file reference.');
            const file = projectItem(project, build.fileRef);
            return file.path?.endsWith('.swift') === true ? [projectPath(project, build.fileRef)] : [];
        });
}

// The folders whose source files Xcode manages, each with the files its exceptions leave out.
function targetFolders(project: XcodeProject, id: string, target: ProjectEntry): Folder[] {
    return (target.fileSystemSynchronizedGroups ?? []).map((groupId) => {
        const group = projectItem(project, groupId);
        const path = projectPath(project, groupId);
        const exceptions = (group.exceptions ?? []).map((exceptionId) => projectItem(project, exceptionId));
        const excluded = exceptions
            .filter((exception) => exception.target === id)
            .flatMap((exception) => (exception.membershipExceptions ?? []).map((name) => posix.join(path, name)));
        return { path: `${path}/`, excluded: new Set(excluded) };
    });
}

// Validate project metadata without requiring source paths or a main group.
function readProject(text: string): ProjectMetadata {
    const project = pbxprojSchema.parse(parse(text));
    const root = project.objects[project.rootObject];
    if (root?.isa !== 'PBXProject') throw new Error('The Xcode project has no project root.');
    return { objects: project.objects, root };
}

/**
 * Find the Swift sources and managed folders that belong to project targets.
 * @param text the project file text
 * @param directory the folder the project file lives in, relative to the repository root
 * @returns the source paths and managed folders with their exclusions
 */
export function readPbxproj(text: string, directory: string): ProjectSources {
    const parsed = pbxprojSchema.parse(parse(text));
    const root = projectItem(parsed, parsed.rootObject);
    if (root.isa !== 'PBXProject' || root.mainGroup === undefined)
        throw new Error('The Xcode project has no main group.');
    const project: XcodeProject = {
        objects: parsed.objects,
        root: { ...root, mainGroup: root.mainGroup },
        directory,
        parents: parentGroups(parsed.objects),
        visiting: new Set(),
    };
    const sources = new Set<string>();
    const folders: Folder[] = [];
    for (const id of root.targets ?? []) {
        const target = projectItem(project, id);
        if (target.isa !== 'PBXNativeTarget') continue;
        for (const source of targetSources(project, target)) sources.add(source);
        folders.push(...targetFolders(project, id, target));
    }
    return { sources, folders };
}

/**
 * Find test-target names without requiring build settings for their source paths.
 * @param text the project file text
 * @returns the names of the test targets
 */
export function testTargets(text: string): string[] {
    const project = readProject(text);
    const root = project.root;
    return (root.targets ?? []).flatMap((id) => {
        const target = project.objects[id];
        if (target === undefined) throw new Error(`The Xcode project references an unknown target: ${id}.`);
        if (!/^com\.apple\.product-type\.bundle\.(?:unit-test|ui-testing)$/u.test(target.productType ?? '')) return [];
        if (target.name === undefined) throw new Error('An Xcode test target has no name.');
        return [target.name];
    });
}

/**
 * Find native compiler and SDK settings without reading project source paths.
 * @param text the authored project file
 * @returns the first declared SDK and Swift version
 */
export function projectBuildSettings(text: string): ProjectBuildSettings {
    const project = readProject(text);
    const settings = Object.values(project.objects).flatMap((entry) => entry.buildSettings ?? []);
    return {
        sdkRoot: settings.find((entry) => entry.SDKROOT !== undefined)?.SDKROOT,
        swiftVersion: settings.find((entry) => entry.SWIFT_VERSION !== undefined)?.SWIFT_VERSION,
    };
}
