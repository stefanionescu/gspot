import { posix } from 'node:path';
import { readText } from '#cli/system/files/reads.ts';
import type { CheckSession } from '#cli/types/engine/run.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckFinding } from '#cli/types/engine/tool-runs.ts';
import type { YamlFinding, YamlAnchorToken } from '#cli/types/configurations/general.ts';

import {
    CST,
    visit,
    isNode,
    isAlias,
    isScalar,
    type Node,
    type Scalar,
    LineCounter,
    type Document,
    parseAllDocuments,
} from 'yaml';
import {
    YAML_RULES,
    YAML_TRUTHY,
    YAML_MESSAGES,
    YAML_COMMIT_USE,
    YAML_LEADING_ZERO,
    YAML_TRAILING_ZERO,
    YAML_REQUIRED_NAMES,
    YAML_VERSION_COMMENT,
    YAML_GENERATED_ANCHOR,
} from '#cli/config/configurations/general.ts';

function listScalarFindings(node: Scalar, isKey: boolean): YamlFinding[] {
    const source = node.source ?? '';
    const offset = node.range?.[0] ?? 0;
    if (node.type !== 'PLAIN' || node.tag !== undefined) return [];
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

function listSourceAnnotations(token: CST.Token): CST.SourceToken[] {
    const found = new Map<number, CST.SourceToken>();
    CST.visit({ start: [], value: token }, (member) => {
        const sources = [
            ...member.start,
            ...(member.sep ?? []),
            ...[member.key, member.value].flatMap((value) =>
                value === undefined || value === null
                    ? []
                    : [
                          ...('end' in value ? (value.end ?? []) : []),
                          ...(value.type === 'block-scalar' ? value.props : []),
                      ],
            ),
        ];
        for (const source of sources) {
            if (source.type === 'comment' || source.type === 'anchor') found.set(source.offset, source);
        }
    });
    return [...found.values()];
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
    const declarations: Node[] = [];
    const used = new Set<Node>();
    const findings: YamlFinding[] = [];
    visit(document, (_key, node) => {
        if (isAlias(node)) {
            const target = node.resolve(document);
            if (target === undefined)
                findings.push({
                    offset: node.range?.[0] ?? 0,
                    rule: YAML_RULES.anchors,
                    message: `Alias *${node.source} has no preceding anchor in this document.`,
                });
            else used.add(target);
        } else if (isNode(node) && node.anchor !== undefined) declarations.push(node);
    });
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
Report YAML syntax, ambiguous values, unused anchors, and the file conventions from YAML.md.

@param session the repository's cached source files.
@param planned the YAML files selected for this scope.
*/
export function checkYaml(session: CheckSession, planned: PlannedCheck): CheckFinding[] {
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
