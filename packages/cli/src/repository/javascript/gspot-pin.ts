import { patch } from '@decimalturn/toml-patch';
import { applyEdits, modify } from 'jsonc-parser/lib/esm/main.js';
import semver from 'semver';

import cliPackage from '#cli-package' with { type: 'json' };
import { MISE_CONFIG_FILE } from '#cli/config/manifests.ts';
import { PACKAGE_JSON } from '#cli/config/parsers.ts';
import {
    DEFAULT_JSON_INDENT,
    GSPOT_MISE_OPTIONS,
    GSPOT_MISE_TOOL,
    JSON_INDENT_PATTERN,
    SETUP_NODE_VERSION,
} from '#cli/config/repository/javascript.ts';
import { OWNER_WRITABLE_FILE } from '#cli/config/repository/setup.ts';
import { parseJsonFile } from '#cli/parsers/formats/json.ts';
import { parseTomlFile } from '#cli/parsers/formats/toml.ts';
import { readLockedVersions } from '#cli/parsers/projects/lockfiles.ts';
import { readPackageJson } from '#cli/repository/dependencies.ts';
import { selectStartRunner } from '#cli/repository/javascript/package-manager.ts';
import { miseToolsSchema, packageJsonSchema } from '#cli/schemas/parsers.ts';
import { createRunCache } from '#cli/system/cache.ts';
import { GspotError } from '#cli/system/errors.ts';
import { findText } from '#cli/system/files/reads.ts';
import { findValueAt, isTable } from '#cli/system/tables.ts';
import { compareText } from '#cli/system/text.ts';
import type { Files } from '#cli/types/system.ts';

const MISE_NODE_TOOL = 'node';

function readMisePin(root: string): string | undefined {
    const text = findText(root, MISE_CONFIG_FILE);
    if (text === undefined) return undefined;
    const pin = findValueAt(parseTomlFile(MISE_CONFIG_FILE, text), ['tools', GSPOT_MISE_TOOL]);
    const version = isTable(pin) ? pin['version'] : pin;
    return typeof version === 'string' ? version : undefined;
}

function readCliSpecifier(root: string): string | undefined {
    const { name } = cliPackage;
    const manifest = readPackageJson(root, PACKAGE_JSON);
    return manifest?.devDependencies?.[name] ?? manifest?.dependencies?.[name];
}

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

/**
Pin this gspot in mise.toml, and pin Node.js when mise.toml names none, because mise otherwise starts gspot with the
Node.js of the system.

@param writer the repository handle.
*/
function writeMisePin(writer: Files): void {
    const tools = writer.read(MISE_CONFIG_FILE);
    const text = tools?.bytes.toString('utf8') ?? '';
    const document = parseTomlFile(MISE_CONFIG_FILE, text, miseToolsSchema);
    const pin = { version: cliPackage.version, ...GSPOT_MISE_OPTIONS };
    const node = document.tools[MISE_NODE_TOOL] === undefined ? { [MISE_NODE_TOOL]: SETUP_NODE_VERSION } : {};
    const next = { ...document, tools: { ...node, ...document.tools, [GSPOT_MISE_TOOL]: pin } };
    const patched = patch(text, next);
    writer.write(MISE_CONFIG_FILE, {
        bytes: Buffer.from(patched.endsWith('\n') ? patched : `${patched}\n`),
        mode: tools?.mode ?? OWNER_WRITABLE_FILE,
    });
}

/**
Read the gspot version that a repository pins where its hooks start gspot. A package.json dependency gives its locked
version, and a repository without that dependency gives its mise tool.

@param root the repository root.
@returns undefined without a pin, or for a dependency that names no version.
*/
export function readGspotPin(root: string): string | undefined {
    const specifier = readCliSpecifier(root);
    if (specifier === undefined) return readMisePin(root);
    const locked = readLockedVersions(createRunCache(root), '')?.get(cliPackage.name);
    return locked ?? semver.valid(specifier) ?? undefined;
}

/**
Say that the repository pins another gspot version than this one, and name the install of the pinned one.

@param root the repository root.
@returns undefined without a pin, or when this gspot is the pinned version.
*/
export function findGspotPinMismatch(root: string): string | undefined {
    const pin = readGspotPin(root);
    if (pin === undefined || pin === cliPackage.version) return undefined;
    const install = selectStartRunner(root).installCommand.replace('<version>', () => pin);
    return `This repository pins gspot ${pin}; this is gspot ${cliPackage.version}. Run ${install}.`;
}

/**
Refuse to run another version than the one that the repository pins.

@param root the repository root.
*/
export function assertGspotPin(root: string): void {
    const mismatch = findGspotPinMismatch(root);
    if (mismatch !== undefined) throw new GspotError('arguments', mismatch);
}

/**
Pin this gspot where the hooks start it: as a development dependency, or as a mise tool without a package.json.

@param writer the repository handle.
@param path the file that takes the pin, when the plan chose one.
*/
export function writeGspotPin(writer: Files, path?: string): void {
    const manifest = writer.read(PACKAGE_JSON);
    if (manifest !== undefined && path !== MISE_CONFIG_FILE) {
        const bytes = Buffer.from(addPackagePin(manifest.bytes.toString('utf8')));
        writer.write(PACKAGE_JSON, { ...manifest, bytes });
        return;
    }
    writeMisePin(writer);
}
