import picomatch from 'picomatch';
import { join, posix } from 'node:path';
import { quotedEnd } from '#cli/parsers/comments.ts';
import { scratchFolder } from '#cli/system/files.ts';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { readSource } from '#cli/system/file-reads.ts';
import { runCheckTool } from '#cli/execution/command/tool.ts';
import { toolOutputDetail } from '#cli/execution/command/output.ts';
import type { Mount, NginxMounts, DirectiveScan } from '#cli/types/checks/infrastructure.ts';
import { type Finding, type CheckInput, type CheckOutcome } from '#cli/types/execution/check.ts';

import {
    NGINX_CONF,
    WORD_STOPS,
    LOCAL_NAMES,
    VOLUME_FLAG,
    NGINX_FOLDER,
    ADD_HOST_FLAG,
    ESCAPE_LENGTH,
    HOST_PATTERNS,
    NGINX_ESCAPES,
    ERROR_LOCATION,
    OPENSSL_PROGRAM,
    QUOTED_ARGUMENT,
    READ_ONLY_MOUNT,
    LOOPBACK_ADDRESS,
    OPENSSL_KEY_FLAG,
    WORD_START_STOPS,
    ESCAPED_CHARACTER,
    NGINX_MAIN_TARGET,
    NGINX_PUNCTUATION,
    NGINX_TEST_COMMAND,
    DOCKER_RUN_ARGUMENTS,
    CERTIFICATE_ARGUMENTS,
    CERTIFICATE_DIRECTIVES,
    OPENSSL_CERTIFICATE_FLAG,
} from '#cli/config/checks/infrastructure/nginx.ts';

// Include paths use the main configuration directory, matching nginx prefix semantics.
function includedFiles(input: CheckInput, text: string, base: string): Pick<Mount, 'path' | 'target'>[] {
    const included: Pick<Mount, 'path' | 'target'>[] = [];
    for (const [name, value] of parseDirectives(text)) {
        if (name !== 'include' || value === undefined || value.includes('$')) continue;
        const target = posix.resolve(NGINX_FOLDER, value);
        const isIncluded = picomatch(posix.normalize(posix.join(base, posix.relative(NGINX_FOLDER, target))));
        for (const file of input.files.filter((candidate) => isIncluded(candidate.path)))
            included.push({ path: file.path, target: posix.resolve(NGINX_FOLDER, posix.relative(base, file.path)) });
    }
    return included;
}

function copyNginxFiles(input: CheckInput, path: string, work: string): Map<string, Mount> {
    const directory = mkdtempSync(join(work, 'configuration-'));
    const configurations = new Map<string, Mount>();
    const pending = [{ path, target: NGINX_MAIN_TARGET }];
    const base = posix.dirname(path);
    for (const entry of pending) {
        if (configurations.has(entry.target)) continue;
        const source = join(directory, `${String(configurations.size)}.conf`);
        const bytes = readSource(input.root, entry.path, input.reads);
        writeFileSync(source, bytes);
        const text = bytes.toString('utf8');
        configurations.set(entry.target, { ...entry, source, text });
        pending.push(...includedFiles(input, text, base));
    }
    return configurations;
}

function syntaxOutcome(
    check: string,
    path: string,
    configurations: Map<string, Mount>,
    diagnostic: string,
): CheckOutcome {
    const location = ERROR_LOCATION.exec(diagnostic)?.groups;
    const { file: target = '', line = '1' } = location === undefined ? {} : location;
    const file = configurations.get(target)?.path ?? path;
    return {
        findings: [{ check, file, line: Number(line), rule: 'syntax', message: diagnostic, fixable: false }],
        files: configurations.has(target) ? [file] : [],
    };
}

async function testNginxFile(input: CheckInput, path: string, work: string, image: string): Promise<CheckOutcome> {
    const configurations = copyNginxFiles(input, path, work);
    const mounts = {
        configs: [...configurations.values()],
        certificate: join(work, 'certificate.pem'),
        key: join(work, 'key.pem'),
    };
    const argv = testArguments([...configurations.values()].map((entry) => entry.text).join('\n'), mounts, image);
    const result = await runCheckTool(input, ['docker', ...argv], { cwd: input.root });
    if (result.code === 0) {
        const parsed = [...result.stdout.matchAll(/^# configuration file (?<path>[^\n]+):$/gmu)]
            .map((match) => match.groups?.['path'])
            .filter((path) => path !== undefined);
        if (!parsed.includes(NGINX_MAIN_TARGET))
            throw new Error('The nginx run produced no configuration dump confirming the tested source.');
        return {
            findings: [],
            files: parsed.flatMap((target) => {
                const configuration = configurations.get(target);
                return configuration === undefined ? [] : [configuration.path];
            }),
        };
    }
    const diagnostic = result.stderr.split('\n').find((line) => line.includes('[emerg]'));
    if (result.code !== 1 || diagnostic === undefined)
        throw new Error(`The nginx run failed (exit ${String(result.code)}): ${result.stderr.trim()}`);
    return syntaxOutcome(input.check.name, path, configurations, diagnostic);
}

// The index past an escape pair or a braced variable that starts at at, or `-1` when neither starts there.
function protectedUnitEnd(text: string, at: number): number {
    const char = text[at];
    if (char === '\\') return at + 1 < text.length ? at + ESCAPE_LENGTH : -1;
    if (char !== '$' || text[at + 1] !== '{') return -1;
    const close = text.indexOf('}', at + '${'.length);
    return close === -1 ? -1 : close + 1;
}

// The index past one unit of a bare word: an escape pair, a braced variable, or one plain character.
function unitEnd(text: string, at: number, stops: RegExp): number {
    const special = protectedUnitEnd(text, at);
    if (special !== -1) return special;
    return stops.test(text[at] ?? '') ? at : at + 1;
}

// The index past the bare word that starts at at, or at itself when no word starts there.
function wordEnd(text: string, at: number): number {
    let end = unitEnd(text, at, WORD_START_STOPS);
    if (end === at) return at;
    while (end < text.length) {
        const next = unitEnd(text, end, WORD_STOPS);
        if (next === end) break;
        end = next;
    }
    return end;
}

// A comment: the hash to the end of the line.
function nginxComment(text: string, at: number): DirectiveScan {
    const end = text.indexOf('\n', at);
    const stop = end === -1 ? text.length : end;
    return { token: text.slice(at, stop), end: stop };
}

// The comment, punctuation, quoted argument, or bare word at at; skip a character that starts none.
function scanAt(text: string, at: number): DirectiveScan {
    const char = text[at] ?? '';
    if (/\s/u.test(char)) return { token: undefined, end: at + 1 };
    if (char === '#') return nginxComment(text, at);
    if (NGINX_PUNCTUATION.has(char)) return { token: char, end: at + 1 };
    const end = char === '"' || char === "'" ? quotedEnd(text, at) : wordEnd(text, at);
    return end <= at ? { token: undefined, end: at + 1 } : { token: text.slice(at, end), end };
}

// The tokens of an nginx configuration: comments, punctuation, quoted arguments, and bare words.
function tokenize(text: string): string[] {
    const found: string[] = [];
    let at = 0;
    while (at < text.length) {
        const scan = scanAt(text, at);
        if (scan.token !== undefined) found.push(scan.token);
        at = scan.end;
    }
    return found;
}

/**
 * Docker arguments that run nginx -t over one tool file.
 * @param text the tool file text.
 * @param mounts the host paths: the tool file, certificate, and key.
 * @param mounts.configs the captured tool files and container paths.
 * @param mounts.certificate the throwaway certificate.
 * @param mounts.key the throwaway key.
 * @param image the nginx image.
 * @returns the argv after docker.
 */
function testArguments(text: string, mounts: NginxMounts, image: string): string[] {
    const parsed = parseDirectives(text);
    const hosts = new Set(
        parsed.flatMap(([name, value]) => {
            if (value === undefined || value.includes('$')) return [];
            const host = HOST_PATTERNS.get(name)?.exec(value)?.[1];
            return host === undefined || LOCAL_NAMES.has(host) ? [] : [host];
        }),
    );
    const certificates = new Map(
        Object.entries(CERTIFICATE_DIRECTIVES).map(([directive, kind]) => [directive, mounts[kind]]),
    );
    const volumes = [
        ...mounts.configs.map(({ source, target }) => `${source}:${target}${READ_ONLY_MOUNT}`),
        ...parsed.flatMap(([name, path]) => {
            if (path === undefined || path.includes('$')) return [];
            const source = certificates.get(name);
            return source === undefined ? [] : [`${source}:${posix.resolve(NGINX_FOLDER, path)}${READ_ONLY_MOUNT}`];
        }),
    ];
    return [
        ...DOCKER_RUN_ARGUMENTS,
        ...[...hosts].flatMap((host) => [ADD_HOST_FLAG, `${host}:${LOOPBACK_ADDRESS}`]),
        ...[...new Set(volumes)].flatMap((volume) => [VOLUME_FLAG, volume]),
        image,
        ...NGINX_TEST_COMMAND,
    ];
}

/**
 * Read directive arguments without changing quoted whitespace or treating comments as configuration.
 * @param text the nginx configuration text.
 * @returns each directive as its name followed by its arguments.
 */
function parseDirectives(text: string): [string, ...string[]][] {
    const found: [string, ...string[]][] = [];
    let directive: string[] = [];
    for (const token of tokenize(text)) {
        if (token.startsWith('#')) continue;
        switch (token) {
            case '}': {
                directive = [];
                break;
            }
            case ';':
            case '{': {
                const [name, ...args] = directive;
                if (name !== undefined) found.push([name, ...args]);
                directive = [];
                break;
            }
            default: {
                directive.push(
                    token
                        .replace(QUOTED_ARGUMENT, '$2')
                        .replaceAll(
                            ESCAPED_CHARACTER,
                            (_, escaped: string) =>
                                Object.entries(NGINX_ESCAPES).find(([name]) => name === escaped)?.[1] ?? escaped,
                        ),
                );
            }
        }
    }
    return found;
}

/**
 * Tests every tracked nginx.conf with the server's own parser.
 * @param input the check input.
 * @returns one finding for each file nginx refuses.
 */
export async function nginxConfigTest(input: CheckInput): Promise<CheckOutcome> {
    const image = input.selection.view.options('tools.nginx')['image'];
    const paths = input.files
        .map((file) => file.path)
        .filter((path) => path === NGINX_CONF || path.endsWith(`/${NGINX_CONF}`));
    if (paths.length === 0) return { findings: [], files: [] };
    using workFolder = scratchFolder();
    const work = workFolder.path;
    const certificate = await runCheckTool(
        input,
        [
            OPENSSL_PROGRAM,
            ...CERTIFICATE_ARGUMENTS,
            OPENSSL_KEY_FLAG,
            join(work, 'key.pem'),
            OPENSSL_CERTIFICATE_FLAG,
            join(work, 'certificate.pem'),
        ],
        { cwd: work },
    );
    if (certificate.code !== 0)
        throw new Error(
            `The openssl command could not write the temporary certificate: ${toolOutputDetail(certificate, 'The tool printed no diagnostic.')}`,
        );
    const findings: Finding[] = [];
    const checked = new Set<string>();
    for (const path of paths) {
        const outcome = await testNginxFile(input, path, work, image);
        findings.push(...outcome.findings);
        for (const file of outcome.files) checked.add(file);
    }
    return { findings, files: [...checked] };
}
