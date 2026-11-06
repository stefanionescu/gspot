import { posix } from 'node:path';

import type { Node } from 'web-tree-sitter';

import {
    ALIAS_WILDCARD_SIDES,
    ASSET_FOLDER,
    ASSET_GLOB_CALL,
    ASSET_REFERENCE_PREFIX,
    ASSET_REFERENCE_SUFFIX,
    CONVENTIONAL_ASSETS,
    TEXT_EXTENSIONS,
    UNUSED_ASSET_MESSAGE,
    UNUSED_ASSET_RULE,
} from '#cli/config/configurations/framework.ts';
import { WHITESPACE_RUN } from '#cli/config/parsers.ts';
import { FILENAME_TAGS, GIT_FILE_MODES, SYMLINK_MODE } from '#cli/config/repository/files.ts';
import { UNUSED_ASSET_EXPLANATIONS } from '#cli/configurations/framework/site/explanations.ts';
import { getStringLiteral, listJavascriptSources } from '#cli/parsers/code/environment.ts';
import { parseSource } from '#cli/parsers/code/grammars.ts';
import { readScopeAliases } from '#cli/repository/javascript/aliases.ts';
import { findText } from '#cli/system/files/reads.ts';
import { buildPathMatcher } from '#cli/system/matchers.ts';
import { extractParentFolder } from '#cli/system/paths.ts';
import { escapeRegExp } from '#cli/system/text.ts';
import type { AssetGlobImport, AssetSource } from '#cli/types/configurations/language.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckCode } from '#cli/types/engine/run.ts';
import type { CheckFinding } from '#cli/types/engine/tool-runs.ts';
import type { ComponentScript } from '#cli/types/parsers.ts';
import type { Session } from '#cli/types/tools.ts';

function getGlobPatterns(node: Node): string[] | undefined {
    const argument = node.childForFieldName('arguments')?.namedChild(0);
    if (argument?.type !== 'array') {
        const pattern = getStringLiteral(argument);
        return pattern === undefined ? undefined : [pattern];
    }
    const patterns = argument.namedChildren.map((element) => getStringLiteral(element));
    return patterns.includes(undefined) ? undefined : (patterns as string[]);
}

async function readGlobImports(source: ComponentScript, session: Session): Promise<AssetGlobImport[]> {
    using tree = await parseSource(source.grammar, source.source, session);
    return tree.rootNode.descendantsOfType('call_expression').flatMap((node) => {
        const name = node.childForFieldName('function')?.text.replaceAll(WHITESPACE_RUN, '');
        const patterns = name === ASSET_GLOB_CALL ? getGlobPatterns(node) : undefined;
        return patterns === undefined ? [] : [{ patterns, text: node.text }];
    });
}

function listAliasSpecifiers(path: string, aliases: Record<string, string>): string[] {
    return Object.entries(aliases).flatMap(([pattern, target]) => {
        const [start = '', end] = target.split('*', ALIAS_WILDCARD_SIDES);
        if (end === undefined) return target === path ? [pattern] : [];
        const isMatch = path.length >= start.length + end.length && path.startsWith(start) && path.endsWith(end);
        return isMatch ? [pattern.replace('*', () => path.slice(start.length, path.length - end.length))] : [];
    });
}

function buildAssetPattern(pattern: string, importer: string, scopePath: string): string {
    const isNegative = pattern.startsWith('!');
    const bare = isNegative ? pattern.slice(1) : pattern;
    const target = bare.startsWith('/')
        ? posix.join(scopePath, bare.slice(1))
        : posix.join(extractParentFolder(importer), bare);
    return isNegative ? `!${target}` : target;
}

async function readAssetSource(path: string, text: string, session: Session, scopePath: string): Promise<AssetSource> {
    const matchers: Array<(path: string) => boolean> = [];
    let references = text;
    const sources = text.includes(ASSET_GLOB_CALL) ? await listJavascriptSources(path, text) : [];
    for (const source of sources) {
        const imports = await readGlobImports(source, session);
        for (const imported of imports) {
            matchers.push(
                buildPathMatcher(imported.patterns.map((pattern) => buildAssetPattern(pattern, path, scopePath))),
            );
            references = references.replaceAll(imported.text, '');
        }
    }

    return { path, text: references, matches: (file) => matchers.some((match) => match(file)) };
}

async function checkSiteUnusedAssets(session: Session, planned: PlannedCheck): Promise<CheckFinding[]> {
    const local = new Set(planned.files.map((file) => file.path));
    const paths = new Set([
        ...local,
        ...session.repository.index
            .filter(
                (indexFile) =>
                    indexFile.stage === 0 &&
                    indexFile.mode !== SYMLINK_MODE &&
                    Object.hasOwn(GIT_FILE_MODES, indexFile.mode),
            )
            .map((indexFile) => indexFile.path),
    ]);
    const aliases = readScopeAliases(session.root, planned.scope.path, session.cache);
    const texts: AssetSource[] = [];
    for (const path of paths) {
        const text = TEXT_EXTENSIONS.has(posix.extname(path)) ? findText(session.cache, path) : undefined;
        if (text !== undefined) texts.push(await readAssetSource(path, text, session, planned.scope.path));
    }
    return planned.files
        .filter(
            (file) =>
                ASSET_FOLDER.test(file.path) &&
                !FILENAME_TAGS.has(posix.basename(file.path)) &&
                !TEXT_EXTENSIONS.has(posix.extname(file.path)) &&
                !CONVENTIONAL_ASSETS.test(file.path),
        )
        .filter((file) => {
            const folder = ASSET_FOLDER.exec(file.path);
            const belowAssets = file.path.slice((folder?.index ?? 0) + (folder?.[0].length ?? 0));
            const names = [`${ASSET_REFERENCE_PREFIX}/?${escapeRegExp(belowAssets)}`];
            for (const specifier of listAliasSpecifiers(file.path, aliases)) names.push(escapeRegExp(specifier));
            const reference = new RegExp(`(?:${names.join('|')})${ASSET_REFERENCE_SUFFIX}`, 'u');
            return texts.every(
                ({ path, text, matches }) =>
                    !matches(file.path) &&
                    !reference.test(text) &&
                    !text.includes(posix.relative(extractParentFolder(path), file.path)),
            );
        })
        .map((file) => ({
            file: file.path,
            line: 1,
            rule: UNUSED_ASSET_RULE,
            message: UNUSED_ASSET_MESSAGE,
        }));
}

export const SITE_UNUSED_ASSETS_CHECKS: Readonly<Record<string, CheckCode>> = {
    'site/unused-assets': { check: checkSiteUnusedAssets, explanations: UNUSED_ASSET_EXPLANATIONS },
};
