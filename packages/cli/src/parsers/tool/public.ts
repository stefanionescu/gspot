import ts from 'typescript';
import { posix } from 'node:path';
import { parse } from '@bacons/xcode/json';
import { parse as parseToml } from 'smol-toml';
import { parseJsonc } from '#cli/parsers/public.ts';
import { stripVTControlCharacters } from 'node:util';
import { isRecord } from '#cli/platform/contracts.ts';
import { pbxprojSchema } from '#cli/parsers/schema/xcode.ts';
import { SETTING_REFERENCE } from '#cli/config/parsers/xcode.ts';
import type { NumberedLine } from '#cli/types/parsers/source.ts';
import { typescriptNodes } from '#cli/parsers/source/contracts.ts';
import type { NextSettingsFinding } from '#cli/types/parsers/nextjs.ts';
import { FAILED_CHECK, PASSED_CHECKS } from '#cli/config/parsers/expo.ts';
import { SECRET_NAME, DISABLED_CHECKS } from '#cli/config/parsers/nextjs.ts';
import type { HeaderBlock, HeaderBlocks, WranglerParse } from '#cli/types/parsers/cloudflare.ts';
import { STATUS_CODES, REDIRECT_PARTS, HTTP_HEADER_LINE } from '#cli/config/parsers/cloudflare.ts';

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

function contentLines(text: string): NumberedLine[] {
    return text
        .split('\n')
        .map((text, index) => ({ text, number: index + 1 }))
        .filter((line) => line.text.trim() !== '' && !line.text.trimStart().startsWith('#'));
}

// Whether a Doctor line ends the issues of a failed check: a blank, advice, another check, or the summary.
function isBlockEnd(line: string): boolean {
    if (line === '' || line.startsWith('Advice:')) return true;
    if (line.startsWith('✔ ') || line.startsWith('✖ ')) return true;
    return PASSED_CHECKS.test(line);
}

// Names whose values are computed at runtime cannot establish a configuration option.
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

/**
 * Parse a Wrangler document without repository I/O.
 * @param text the authored document contents
 * @param path the document path for selecting TOML or JSON with comments
 * @returns the parsed object or its syntax diagnostic
 */
export function parseWrangler(text: string, path: string): WranglerParse {
    try {
        if (path.endsWith('.toml')) return { table: parseToml(text), problem: undefined };
        const parsed = parseJsonc(text);
        return isRecord(parsed)
            ? { table: parsed, problem: undefined }
            : { table: undefined, problem: 'The file does not parse as JSON with comments.' };
    } catch (error) {
        return { table: undefined, problem: error instanceof Error ? error.message : 'The file does not parse.' };
    }
}

/**
 * Read path blocks, their headers and syntax diagnostics with original line numbers.
 * @param text the authored headers file
 * @returns the blocks and findings
 */
export function parseHeaders(text: string): HeaderBlocks {
    const blocks: HeaderBlock[] = [];
    const findings = contentLines(text).flatMap((line): NumberedLine[] => {
        if (!/^\s/u.test(line.text)) {
            blocks.push({ path: line.text.trim(), line: line.number, headers: [] });
            return line.text.startsWith('/') || line.text.startsWith('https://')
                ? []
                : [
                      {
                          number: line.number,
                          text: 'Start this block with a path beginning with / or an https:// address.',
                      },
                  ];
        }
        const block = blocks.at(-1);
        if (block === undefined) return [{ number: line.number, text: 'Add a path line before this header.' }];
        const header = line.text.trim();
        if (header.startsWith('! ')) return [];
        if (!HTTP_HEADER_LINE.test(header)) return [{ number: line.number, text: 'Write this header as Name: value.' }];
        const colon = header.indexOf(':');
        block.headers.push({
            name: header.slice(0, colon).toLowerCase(),
            value: header.slice(colon + 1).trim(),
            line: line.number,
        });
        return [];
    });
    return { blocks, findings };
}

/**
 * The findings of one redirects file: each rule is a source, a destination, and an optional status Cloudflare knows.
 * @param text the authored asset contents
 * @returns the findings, each with its line
 */
export function redirectFindings(text: string): NumberedLine[] {
    const entries = contentLines(text);
    return entries.flatMap((line) => {
        const parts = line.text.trim().split(/\s+/u);
        const [source = '', , status] = parts;
        if (parts.length < REDIRECT_PARTS.least || parts.length > REDIRECT_PARTS.most)
            return [{ number: line.number, text: 'A redirect is a source, a destination, and an optional status.' }];
        if (!source.startsWith('/') && !source.startsWith('https://'))
            return [{ number: line.number, text: 'Start the redirect source with / or https://.' }];
        if (status === undefined) return [];
        const isKnown = STATUS_CODES.has(status);
        return isKnown
            ? []
            : [{ number: line.number, text: `Use a supported Cloudflare redirect status instead of ${status}.` }];
    });
}

/**
 * Reads the report Expo Doctor prints.
 * @param stdout what Doctor printed
 * @returns one finding for each check Doctor reports as failed, with its issues
 */
export function parseExpoDoctor(stdout: string): string[] {
    const lines = stripVTControlCharacters(stdout)
        .split('\n')
        .map((line) => line.trim());
    return lines.flatMap((line, index): string[] => {
        const description = FAILED_CHECK.exec(line)?.groups?.['description'];
        if (description === undefined) return [];
        const rest = lines.slice(index + 1);
        const end = rest.findIndex((next) => isBlockEnd(next));
        const issues = end === -1 ? rest : rest.slice(0, end);
        return [[description, ...issues].join(' ')];
    });
}

/**
 * Read literal options without treating comments, strings, or nested env values as property names.
 * @param path the configuration file name
 * @param text the source text
 * @returns disabled checks and likely secret keys with one-based source lines
 */
export function nextSettingsFindings(path: string, text: string): NextSettingsFinding[] {
    const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
    return typescriptNodes(source)
        .filter((node) => ts.isPropertyAssignment(node))
        .flatMap((node): NextSettingsFinding[] => {
            const name = propertyName(node.name);
            if (name === undefined) return [];
            const value = literalValue(node.initializer);
            if (DISABLED_CHECKS.has(name) && value.kind === ts.SyntaxKind.TrueKeyword)
                return [
                    {
                        name,
                        line: source.getLineAndCharacterOfPosition(node.name.getStart(source)).line + 1,
                        kind: 'checks-off',
                    },
                ];
            if (name !== 'env' || !ts.isObjectLiteralExpression(value)) return [];
            return value.properties
                .filter((property) => ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property))
                .flatMap((property): NextSettingsFinding[] => {
                    const key = propertyName(property.name);
                    if (key === undefined || !SECRET_NAME.test(key)) return [];
                    return [
                        {
                            name: key,
                            line: source.getLineAndCharacterOfPosition(property.name.getStart(source)).line + 1,
                            kind: 'env-secret',
                        },
                    ];
                });
        });
}
