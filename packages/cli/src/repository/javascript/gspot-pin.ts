import semver from 'semver';
import { find } from '#cli/system/files/reads.ts';
import type { Files } from '#cli/types/system.ts';
import { GspotError } from '#cli/system/errors.ts';
import { PACKAGE_JSON } from '#cli/config/parsers.ts';
import { createRunCache } from '#cli/system/cache.ts';
import { parse, patch } from '@decimalturn/toml-patch';
import cliPackage from '#cli-package' with { type: 'json' };
import { MISE_CONFIG_FILE } from '#cli/config/manifests.ts';
import { parseTomlFile } from '#cli/parsers/formats/toml.ts';
import { isTable, findValueAt } from '#cli/system/tables.ts';
import { readPackageJson } from '#cli/repository/dependencies.ts';
import { modify, applyEdits } from 'jsonc-parser/lib/esm/main.js';
import { OWNER_WRITABLE_FILE } from '#cli/config/repository/setup.ts';
import { readLockedVersions } from '#cli/parsers/projects/lockfiles.ts';
import { selectStartRunner } from '#cli/repository/javascript/package-manager.ts';
import { GSPOT_MISE_TOOL, PIN_JSON_FORMAT, GSPOT_MISE_OPTIONS } from '#cli/config/repository/javascript.ts';

function readMisePin(root: string): string | undefined {
    const text = find(root, MISE_CONFIG_FILE);
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
Refuse to run another version than the one that the repository pins.

@param root the repository root.
*/
export function assertGspotPin(root: string): void {
    const pin = readGspotPin(root);
    if (pin === undefined || pin === cliPackage.version) return;
    const install = selectStartRunner(root).installCommand.replace('<version>', () => pin);
    throw new GspotError(
        'arguments',
        `This repository pins gspot ${pin}; this is gspot ${cliPackage.version}. Run ${install}.`,
    );
}

/**
Select the file that takes the pin of init.

@param root the repository root.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The init plan names the file that writeGspotPin changes through it.
export function selectPinPath(root: string): string {
    return readPackageJson(root, PACKAGE_JSON) === undefined ? MISE_CONFIG_FILE : PACKAGE_JSON;
}

/**
Pin this gspot where the hooks start it: as a development dependency, or as a mise tool without a package.json.

@param writer the repository handle.
*/
export function writeGspotPin(writer: Files): void {
    const manifest = writer.read(PACKAGE_JSON);
    if (manifest !== undefined) {
        const text = manifest.bytes.toString('utf8');
        const edits = modify(text, ['devDependencies', cliPackage.name], cliPackage.version, PIN_JSON_FORMAT);
        writer.write(PACKAGE_JSON, { ...manifest, bytes: Buffer.from(applyEdits(text, edits)) });
        return;
    }
    const tools = writer.read(MISE_CONFIG_FILE);
    const text = tools?.bytes.toString('utf8') ?? '';
    const document = parse(text) as { tools?: Record<string, unknown> };
    const pin = { version: cliPackage.version, ...GSPOT_MISE_OPTIONS };
    const next = { ...document, tools: { ...document.tools, [GSPOT_MISE_TOOL]: pin } };
    writer.write(MISE_CONFIG_FILE, {
        bytes: Buffer.from(patch(text, next)),
        mode: tools?.mode ?? OWNER_WRITABLE_FILE,
    });
}
