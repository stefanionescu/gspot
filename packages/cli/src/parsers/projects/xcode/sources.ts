import { posix } from 'node:path';

import { SWIFT_EXTENSION } from '#cli/config/parsers/code.ts';
import {
    GROUP_CYCLE_MESSAGE,
    MISSING_FILE_REF_MESSAGE,
    MISSING_MAIN_GROUP_MESSAGE,
    PBXPROJ_SUFFIX,
    SETTING_REFERENCE,
} from '#cli/config/parsers/projects.ts';
import { buildProjectParseError, getElement, parsePbxproj } from '#cli/parsers/projects/xcode/document.ts';
import { extractParentFolder } from '#cli/system/paths.ts';
import type { PbxElement, ProjectSources, TargetFolder, XcodeProject } from '#cli/types/parsers.ts';

function buildParentGroups(elements: Record<string, PbxElement>): Map<string, string> {
    const parents = new Map<string, string>();
    for (const [id, element] of Object.entries(elements)) {
        const children = element.children ?? [];
        for (const child of children) {
            if (parents.has(child))
                throw new Error(`The Xcode project gives an object multiple parent groups: ${child}.`);
            parents.set(child, id);
        }
    }
    return parents;
}

function buildGroupFolder(project: XcodeProject, id: string): string {
    if (id === project.root.mainGroup) return posix.join(project.folder, project.root.projectDirPath ?? '');
    const parent = project.parents.get(id);
    if (parent === undefined) throw new Error(`The Xcode project has no parent group for ${id}.`);
    return buildElementPath(project, parent);
}

function buildTreeFolder(project: XcodeProject, id: string, tree: string): string {
    if (tree === 'SOURCE_ROOT') return project.folder;
    if (tree === '<absolute>') return '/';
    if (tree === '<group>') return buildGroupFolder(project, id);
    throw new Error(`Cannot find the folder of Xcode source tree ${tree} without build settings.`);
}

function buildElementPath(project: XcodeProject, id: string): string {
    if (project.visiting.has(id)) throw new Error(GROUP_CYCLE_MESSAGE);
    project.visiting.add(id);
    const element = getElement(project, id);
    const folder = buildTreeFolder(project, id, element.sourceTree ?? '<group>');
    const path = element.path ?? '';
    if (SETTING_REFERENCE.test(path)) throw new Error(`Cannot find Xcode source path ${path} without build settings.`);
    project.visiting.delete(id);
    return posix.normalize(posix.isAbsolute(path) ? path : posix.join(folder, path));
}

function listTargetSources(project: XcodeProject, target: PbxElement): string[] {
    const phases = (target.buildPhases ?? []).map((phaseId) => getElement(project, phaseId));
    return phases
        .filter((phase) => phase.isa === 'PBXSourcesBuildPhase')
        .flatMap((phase) => phase.files ?? [])
        .flatMap((buildId) => {
            const build = getElement(project, buildId);
            if (build.fileRef === undefined) throw new Error(MISSING_FILE_REF_MESSAGE);
            const file = getElement(project, build.fileRef);
            return file.path?.endsWith(SWIFT_EXTENSION) === true ? buildElementPath(project, build.fileRef) : [];
        });
}

function listTargetFolders(project: XcodeProject, id: string, target: PbxElement): TargetFolder[] {
    return (target.fileSystemSynchronizedGroups ?? []).map((groupId) => {
        const group = getElement(project, groupId);
        const path = buildElementPath(project, groupId);
        const exceptions = (group.exceptions ?? []).map((exceptionId) => getElement(project, exceptionId));
        const excluded = exceptions
            .filter((exception) => exception.target === id)
            .flatMap((exception) => (exception.membershipExceptions ?? []).map((name) => posix.join(path, name)));
        return { path: `${path}/`, excluded: new Set(excluded) };
    });
}

export function parseProjectSources(text: string, path: string): ProjectSources {
    const parsed = parsePbxproj(text, path);
    try {
        const folder = extractParentFolder(path.slice(0, path.indexOf(PBXPROJ_SUFFIX)));
        const root = parsed.root;
        if (root.mainGroup === undefined) throw new Error(MISSING_MAIN_GROUP_MESSAGE);
        const project: XcodeProject = {
            objects: parsed.objects,
            root: { ...root, mainGroup: root.mainGroup },
            folder,
            parents: buildParentGroups(parsed.objects),
            visiting: new Set(),
        };
        const targets = (root.targets ?? []).flatMap((id) => {
            const target = getElement(project, id);
            if (target.isa !== 'PBXNativeTarget') return [];
            return [
                {
                    name: target.name ?? '',
                    sources: listTargetSources(project, target),
                    folders: listTargetFolders(project, id, target),
                },
            ];
        });
        return {
            sources: new Set(targets.flatMap((target) => target.sources)),
            folders: targets.flatMap((target) => target.folders),
            targets,
        };
    } catch (error) {
        throw buildProjectParseError(path, error);
    }
}

export function isInTargetFolder(file: string, folders: TargetFolder[]): boolean {
    return folders.some(({ path, excluded }) => file.startsWith(path) && !excluded.has(file));
}
