import { posix } from 'node:path';
import { extractParentFolder } from '#cli/system/paths.ts';
import { PBXPROJ, SWIFT_EXTENSION } from '#cli/config/files/names.ts';
import { pbxprojSchema } from '#cli/schemas/parsers/projects/xcode.ts';

import {
    PROJECT_TOKENS,
    PROJECT_ESCAPE,
    PROJECT_ESCAPES,
    SETTING_REFERENCE,
    PROJECT_PUNCTUATION,
} from '#cli/config/parsers/projects/xcode.ts';
import {
    type Folder,
    type PbxElement,
    type XcodeProject,
    type ProjectTokens,
    type ParsedPbxproj,
    type ProjectSources,
    type ProjectBuildSettings,
} from '#cli/types/parsers/projects/xcode.ts';

function parseProjectString(token: string | undefined): string {
    if (token === undefined || PROJECT_PUNCTUATION.has(token))
        throw new Error('The Xcode project has an invalid string.');
    if (!token.startsWith('"')) return token;
    return token.slice(1, -1).replace(PROJECT_ESCAPE, (escape: string, sequence: string) => {
        if (sequence.startsWith('U')) return String.fromCodePoint(Number.parseInt(sequence.slice(1), 16));
        return /^[0-7]/u.test(sequence)
            ? String.fromCodePoint(Number.parseInt(sequence, 8))
            : (PROJECT_ESCAPES[sequence] ?? escape);
    });
}

function expectProjectToken(tokens: ProjectTokens, expected: string): void {
    if (tokens.tokens[tokens.index] !== expected) throw new Error(`The Xcode project requires ${expected}.`);
    tokens.index += 1;
}

function parseProjectArray(tokens: ProjectTokens): unknown[] {
    const values: unknown[] = [];
    while (tokens.tokens[tokens.index] !== ')') {
        values.push(parseProjectValue(tokens));
        if (tokens.tokens[tokens.index] !== ',') break;
        tokens.index += 1;
    }
    expectProjectToken(tokens, ')');
    return values;
}

function parseProjectDictionary(tokens: ProjectTokens): Record<string, unknown> {
    const pairs: [string, unknown][] = [];
    while (tokens.tokens[tokens.index] !== '}') {
        const key = parseProjectString(tokens.tokens[tokens.index++]);
        expectProjectToken(tokens, '=');
        pairs.push([key, parseProjectValue(tokens)]);
        expectProjectToken(tokens, ';');
    }
    expectProjectToken(tokens, '}');
    return Object.fromEntries(pairs);
}

function parseProjectValue(tokens: ProjectTokens): unknown {
    const text = tokens.tokens[tokens.index++];
    if (text === '{') return parseProjectDictionary(tokens);
    return text === '(' ? parseProjectArray(tokens) : parseProjectString(text);
}

function parseProjectDocument(text: string): unknown {
    const tokens: string[] = [];
    for (let offset = 0; offset < text.length; ) {
        const match = PROJECT_TOKENS.map((matcher) => {
            matcher.lastIndex = offset;
            return matcher.exec(text);
        }).find((token) => token !== null);
        if (match === undefined) throw new Error(`The Xcode project has invalid syntax at offset ${String(offset)}.`);
        offset += match[0].length;
        const token = match[0];
        if (token.trim() !== '' && !token.startsWith('//') && !token.startsWith('/*')) tokens.push(token);
    }
    const state: ProjectTokens = { tokens, index: 0 };
    const value = parseProjectValue(state);
    if (state.index !== tokens.length) throw new Error('The Xcode project has text after its root dictionary.');
    return value;
}

function getElement(project: Pick<XcodeProject, 'objects'>, id: string): PbxElement {
    const found = project.objects[id];
    if (found === undefined) throw new Error(`The Xcode project references an unknown object: ${id}.`);
    return found;
}

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

function findGroupFolder(project: XcodeProject, id: string): string {
    if (id === project.root.mainGroup) return posix.join(project.folder, project.root.projectDirPath ?? '');
    const parent = project.parents.get(id);
    if (parent === undefined) throw new Error(`The Xcode project has no parent group for ${id}.`);
    return findElementPath(project, parent);
}

function findTreeFolder(project: XcodeProject, id: string, tree: string): string {
    if (tree === 'SOURCE_ROOT') return project.folder;
    if (tree === '<absolute>') return '/';
    if (tree === '<group>') return findGroupFolder(project, id);
    throw new Error(`Cannot find the folder of Xcode source tree ${tree} without build settings.`);
}

function findElementPath(project: XcodeProject, id: string): string {
    if (project.visiting.has(id)) throw new Error('The Xcode project contains a group cycle.');
    project.visiting.add(id);
    const element = getElement(project, id);
    const folder = findTreeFolder(project, id, element.sourceTree ?? '<group>');
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
            if (build.fileRef === undefined) throw new Error('An Xcode source build entry has no file reference.');
            const file = getElement(project, build.fileRef);
            return file.path?.endsWith(SWIFT_EXTENSION) === true ? findElementPath(project, build.fileRef) : [];
        });
}

function listTargetFolders(project: XcodeProject, id: string, target: PbxElement): Folder[] {
    return (target.fileSystemSynchronizedGroups ?? []).map((groupId) => {
        const group = getElement(project, groupId);
        const path = findElementPath(project, groupId);
        const exceptions = (group.exceptions ?? []).map((exceptionId) => getElement(project, exceptionId));
        const excluded = exceptions
            .filter((exception) => exception.target === id)
            .flatMap((exception) => (exception.membershipExceptions ?? []).map((name) => posix.join(path, name)));
        return { path: `${path}/`, excluded: new Set(excluded) };
    });
}

function parsePbxproj(text: string): ParsedPbxproj {
    const project = pbxprojSchema.parse(parseProjectDocument(text));
    const root = project.objects[project.rootObject];
    if (root?.isa !== 'PBXProject') throw new Error('The Xcode project has no project root.');
    return { objects: project.objects, root };
}

/**
Check whether a managed folder holds a file that none of its exceptions leaves out.

@param file the repository-relative file.
@param folders the managed folders of a project or a target.
@returns whether one of the folders holds the file.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: 2 calls in 2 files share it.
export function isInFolders(file: string, folders: readonly Folder[]): boolean {
    return folders.some(({ path, excluded }) => file.startsWith(path) && !excluded.has(file));
}

/**
Find the Swift sources and managed folders that belong to project targets.

@param text the project.pbxproj contents.
@param path the project.pbxproj file, relative to the repository root.
@returns the source paths and managed folders of the project, and the same for each target.
*/
export function parseProjectSources(text: string, path: string): ProjectSources {
    const folder = extractParentFolder(path.slice(0, path.indexOf(PBXPROJ)));
    const parsed = parsePbxproj(text);
    const root = parsed.root;
    if (root.mainGroup === undefined) throw new Error('The Xcode project has no main group.');
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
}

/**
Find compiler and SDK settings without reading project source paths.

@param text the project file.
@returns the first declared SDK and Swift version.
*/
export function parseBuildSettings(text: string): ProjectBuildSettings {
    const project = parsePbxproj(text);
    const settings = Object.values(project.objects).flatMap((pbxRecord) => pbxRecord.buildSettings ?? []);
    return {
        sdkRoot: settings.find((setting) => setting.SDKROOT !== undefined)?.SDKROOT,
        swiftVersion: settings.find((each) => each.SWIFT_VERSION !== undefined)?.SWIFT_VERSION,
    };
}
