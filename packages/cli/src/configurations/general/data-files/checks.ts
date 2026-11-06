import { posix } from 'node:path';

import {
    type Alias,
    CST,
    type Document,
    isAlias,
    isNode,
    isScalar,
    LineCounter,
    type Node,
    parseAllDocuments,
    type Scalar,
    visit,
} from 'yaml';

import {
    YAML_COMMIT_USE,
    YAML_GENERATED_ANCHOR,
    YAML_LEADING_ZERO,
    YAML_MESSAGES,
    YAML_REQUIRED_NAMES,
    YAML_RULES,
    YAML_TRAILING_ZERO,
    YAML_TRUTHY,
    YAML_VERSION_COMMENT,
} from '#cli/config/configurations/general.ts';
import { YAML_EXPLANATIONS } from '#cli/configurations/general/data-files/explanations.ts';
import { readText } from '#cli/system/files/reads.ts';
import type { YamlAnchorToken, YamlFinding } from '#cli/types/configurations/general.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import { type CheckCode, type CheckSession } from '#cli/types/engine/run.ts';
import type { CheckFinding } from '#cli/types/engine/tool-runs.ts';

function listScalarFindings(node: Scalar, isKey: boolean): YamlFinding[] {
    if (node.type !== 'PLAIN' || node.tag !== undefined) return [];
    const source = node.source ?? '';
    const offset = node.range?.[0] ?? 0;
    const rules = [
        {
            found: !isKey && YAML_TRUTHY.test(source),
            rule: YAML_RULES.truthy,
            message: YAML_MESSAGES.truthy,
        },
        { found: YAML_LEADING_ZERO.test(source), rule: YAML_RULES.octal, message: YAML_MESSAGES.octal },
        { found: !isKey && YAML_TRAILING_ZERO.test(source), rule: YAML_RULES.version, message: YAML_MESSAGES.version },
    ];
    return rules.filter(({ found }) => found).map(({ rule, message }) => ({ offset, rule, message }));
}

function listTokenAnnotations(token: CST.Token | null | undefined): CST.Token[] {
    if (token === undefined || token === null) return [];
    const ends = 'end' in token ? (token.end ?? []) : [];
    return token.type === 'block-scalar' ? [...ends, ...token.props] : ends;
}

function listSourceAnnotations(token: CST.Token): CST.SourceToken[] {
    const found = new Map<number, CST.SourceToken>();
    CST.visit({ start: [], value: token }, (member) => {
        const sources = [
            ...member.start,
            ...(member.sep ?? []),
            ...listTokenAnnotations(member.key),
            ...listTokenAnnotations(member.value),
        ];
        for (const source of sources) {
            if (source.type === 'comment' || source.type === 'anchor') found.set(source.offset, source);
        }
    });
    return found.values().toArray();
}

function listCommentFindings(text: string, tokens: CST.SourceToken[]): YamlFinding[] {
    return tokens
        .filter(({ type }) => type === 'comment')
        .flatMap(({ offset }) => {
            const start = text.lastIndexOf('\n', offset - 1) + 1;
            const before = text.slice(start, offset);
            if (before.trim() === '') return [];
            const end = text.indexOf('\n', offset);
            const comment = text.slice(offset, end === -1 ? text.length : end);
            return YAML_COMMIT_USE.test(before) && YAML_VERSION_COMMENT.test(comment)
                ? []
                : [{ offset, rule: YAML_RULES.comments, message: YAML_MESSAGES.comments }];
        });
}

function findAnchorOffset(node: Node, anchors: YamlAnchorToken[]): number {
    const start = node.range?.[0] ?? 0;
    return (
        anchors.findLast(({ offset, source }) => offset <= start && source === `&${node.anchor ?? ''}`)?.offset ?? start
    );
}

function listAnchorFindings(document: Document.Parsed, tokens: CST.SourceToken[]): YamlFinding[] {
    const anchors = tokens.filter(({ type }) => type === 'anchor');
    const aliases: Alias[] = [];
    const declarations: Node[] = [];
    visit(document, (_key, node) => {
        if (isAlias(node)) aliases.push(node);
        else if (isNode(node) && node.anchor !== undefined) declarations.push(node);
    });
    const aliasTargets = aliases.map((alias) => ({ alias, target: alias.resolve(document) }));
    const used = new Set<Node | undefined>(aliasTargets.map(({ target }) => target));
    const findings: YamlFinding[] = aliasTargets
        .filter(({ target }) => target === undefined)
        .map(({ alias }) => ({
            offset: alias.range?.[0] ?? 0,
            rule: YAML_RULES.anchors,
            message: `Alias *${alias.source} has no preceding anchor in this document.`,
        }));
    for (const node of declarations) {
        const offset = findAnchorOffset(node, anchors);
        if (!used.has(node))
            findings.push({
                offset,
                rule: YAML_RULES.anchors,
                message: `Anchor &${node.anchor ?? ''} is never used. Remove it.`,
            });
        if (YAML_GENERATED_ANCHOR.test(node.anchor ?? ''))
            findings.push({
                offset,
                rule: YAML_RULES.anchorNames,
                message: `Name anchor &${node.anchor ?? ''} for what it holds.`,
            });
    }
    return findings;
}

function listDocumentFindings(text: string, document: Document.Parsed): YamlFinding[] {
    const findings: YamlFinding[] = document.errors.map((error) => ({
        offset: error.pos[0],
        rule: error.code === 'DUPLICATE_KEY' ? YAML_RULES.duplicate : YAML_RULES.syntax,
        message: error.message,
    }));
    if (document.errors.length > 0) return findings;
    const token = document.contents?.srcToken;
    const sources = token === undefined ? [] : listSourceAnnotations(token);
    findings.push(...listCommentFindings(text, sources), ...listAnchorFindings(document, sources));
    visit(document, (key, node) => {
        if (!isScalar(node)) return;
        if (key === 'key' && node.value === '<<')
            findings.push({ offset: node.range?.[0] ?? 0, rule: YAML_RULES.merge, message: YAML_MESSAGES.merge });
        findings.push(...listScalarFindings(node, key === 'key'));
    });
    return findings;
}

/**
Report YAML syntax, ambiguous values, unused anchors, and file conventions.

@param session the repository's cached source files.
@param planned the YAML files selected for this scope.
*/
function checkYaml(session: CheckSession, planned: PlannedCheck): CheckFinding[] {
    return planned.files.flatMap(({ path: file }) => {
        const text = readText(session.cache, file);
        const lines = new LineCounter();
        const documents = parseAllDocuments(text, { lineCounter: lines, keepSourceTokens: true, prettyErrors: false });
        const findings = documents.flatMap((document) => listDocumentFindings(text, document));
        if (documents.length > 1)
            findings.push({
                offset: documents[1]?.range[0] ?? 0,
                rule: YAML_RULES.documents,
                message: YAML_MESSAGES.documents,
            });
        if (file.endsWith('.yaml') && !YAML_REQUIRED_NAMES.has(posix.basename(file)))
            findings.push({ offset: 0, rule: YAML_RULES.extension, message: YAML_MESSAGES.extension });
        return findings.map(({ offset, rule, message }) => {
            const { line, col } = lines.linePos(offset);
            return { file, line, column: col, rule, message };
        });
    });
}

export const DATA_FILES_CHECKS: Readonly<Record<string, CheckCode>> = {
    'data-files/yaml': { check: checkYaml, explanations: YAML_EXPLANATIONS },
};
