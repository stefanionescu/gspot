import { patch } from '@decimalturn/toml-patch';
import { applyEdits, modify } from 'jsonc-parser/lib/esm/main.js';
import semver from 'semver';

import cliPackage from '#cli-package' with { type: 'json' };
import { MISE_CONFIG_FILE } from '#cli/config/manifests.ts';
import { PACKAGE_JSON } from '#cli/config/parsers/projects.ts';
import {
    DEFAULT_JSON_INDENT,
    GSPOT_MISE_OPTIONS,
    GSPOT_MISE_TOOL,
    JSON_INDENT_PATTERN,
    SETUP_NODE_VERSION,
} from '#cli/config/repository/projects.ts';
import { NODE_PROGRAM, OWNER_WRITABLE_FILE } from '#cli/config/system.ts';
import { parseJsonFile } from '#cli/parsers/formats/json.ts';
import { parseTomlFile } from '#cli/parsers/formats/toml/parse.ts';
import { readLockedVersions } from '#cli/parsers/projects/lockfiles.ts';
import { readCliSpecifier, selectStartRunner } from '#cli/repository/projects/runner.ts';
import { packageJsonSchema } from '#cli/schemas/parsers.ts';
import { miseToolsSchema } from '#cli/schemas/repository.ts';
import { createRunCache } from '#cli/system/cache.ts';
import { GspotError } from '#cli/system/errors.ts';
import { findText } from '#cli/system/files/reads.ts';
import { isTable } from '#cli/system/tables.ts';
import { compareText } from '#cli/system/text/order.ts';
import type { Files } from '#cli/types/system.ts';

function addPackagePin(text: string): string {
    const indent = JSON_INDENT_PATTERN.exec(text)?.[0] ?? DEFAULT_JSON_INDENT;
    const { devDependencies } = parseJsonFile(PACKAGE_JSON, text, packageJsonSchema);
    const names = devDependencies === undefined ? [] : Object.keys(devDependencies);
    const isSorted = names.every((name, index) => index === 0 || compareText(names[index - 1] as string, name) <= 0);
    const edits = modify(text, ['devDependencies', cliPackage.name], cliPackage.version, {
        formattingOptions: { insertSpaces: !indent.startsWith('\t'), tabSize: indent.length },
        ...(names.length > 0 &&
            isSorted && {
                getInsertionIndex: (properties: string[]) =>
                    properties.filter((name) => compareText(name, cliPackage.name) < 0).length,
            }),
    });
    return applyEdits(text, edits);
}

export function readMiseTools(root: string): Record<string, unknown> {
    return parseTomlFile(MISE_CONFIG_FILE, findText(root, MISE_CONFIG_FILE) ?? '', miseToolsSchema).tools;
}

/**
Any Node.js entry counts, a version list or a table included, so that the pin never replaces the Node.js that the user
chose.
*/
export function hasNodePin(tools: Record<string, unknown>): boolean {
    return tools[NODE_PROGRAM] !== undefined;
}

/**
Get the version that an entry of a mise [tools] table pins: a version, the version of a table, or the first item of a
list, which is the version that mise runs.
*/
export function getMiseToolVersion(entry: unknown): string | undefined {
    const first: unknown = Array.isArray(entry) ? entry[0] : entry;
    const version = isTable(first) ? first['version'] : first;
    return typeof version === 'string' ? version : undefined;
}

export function readMisePin(root: string, tool: string): string | undefined {
    return getMiseToolVersion(readMiseTools(root)[tool]);
}

/**
Pin this gspot in mise.toml, and pin Node.js when mise.toml names none, because mise otherwise starts gspot with the
Node.js of the system.
*/
export function writeMisePin(writer: Files): void {
    const tools = writer.read(MISE_CONFIG_FILE);
    const text = tools?.bytes.toString('utf8') ?? '';
    const document = parseTomlFile(MISE_CONFIG_FILE, text, miseToolsSchema);
    const pin = { version: cliPackage.version, ...GSPOT_MISE_OPTIONS };
    const node = hasNodePin(document.tools) ? {} : { [NODE_PROGRAM]: SETUP_NODE_VERSION };
    const next = { ...document, tools: { ...node, ...document.tools, [GSPOT_MISE_TOOL]: pin } };
    const patched = patch(text, next);
    writer.write(MISE_CONFIG_FILE, {
        bytes: Buffer.from(patched.endsWith('\n') ? patched : `${patched}\n`),
        mode: tools?.mode ?? OWNER_WRITABLE_FILE,
    });
}

export function readGspotPin(root: string): string | undefined {
    const specifier = readCliSpecifier(root);
    if (specifier === undefined) return readMisePin(root, GSPOT_MISE_TOOL);
    const locked = readLockedVersions(createRunCache(root), '')?.get(cliPackage.name);
    return locked ?? semver.valid(specifier) ?? undefined;
}

/**
Find what makes the pin of the repository differ from this gspot. Two pins that differ come first, because the
install command of one pin leaves the other pin on its version.
*/
export function findGspotPinMismatch(root: string): string | undefined {
    const pin = readGspotPin(root);
    const misePin = readMisePin(root, GSPOT_MISE_TOOL);
    if (pin !== undefined && misePin !== undefined && pin !== misePin)
        return `${PACKAGE_JSON} pins gspot ${pin} and ${MISE_CONFIG_FILE} pins gspot ${misePin}. Keep one pin, set it to ${cliPackage.version}, then run gspot install.`;
    if (pin === undefined || pin === cliPackage.version) return undefined;
    const install = selectStartRunner(root).installCommand.replace('<version>', () => pin);
    return `This repository pins gspot ${pin}; this is gspot ${cliPackage.version}. Run ${install}.`;
}

export function assertGspotPin(root: string): void {
    const mismatch = findGspotPinMismatch(root);
    if (mismatch !== undefined) throw new GspotError('arguments', mismatch);
}

/**
Pin this gspot in the devDependencies of the package.json that init found.
*/
export function writePackagePin(writer: Files): void {
    const manifest = writer.read(PACKAGE_JSON);
    if (manifest === undefined) throw new Error(`${PACKAGE_JSON} is missing.`);
    const bytes = Buffer.from(addPackagePin(manifest.bytes.toString('utf8')));
    writer.write(PACKAGE_JSON, { ...manifest, bytes });
}
