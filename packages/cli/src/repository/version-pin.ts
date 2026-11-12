import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { patch } from '@decimalturn/toml-patch';
import { applyEdits, modify } from 'jsonc-parser/lib/esm/main.js';
import semver from 'semver';

import cliPackage from '#cli-package' with { type: 'json' };
import { MISE_CONFIG_FILE } from '#cli/config/manifests.ts';
import { LOCKFILES, PACKAGE_JSON } from '#cli/config/parsers/projects.ts';
import {
    type FROZEN_INSTALLS,
    PNPM_WORKSPACE_FILE,
    YARN_BERRY_MAJOR,
} from '#cli/config/repository/package-managers.ts';
import {
    CI_NODE,
    DEFAULT_JSON_INDENT,
    GSPOT_MISE_OPTIONS,
    GSPOT_MISE_TOOL,
    JSON_INDENT_PATTERN,
    MISE_NODE_PIN_COMMAND,
    NODE_TOOL,
    PACKAGE_MANAGER_LABELS,
    PNPM_WORKSPACE_INSTALL,
    SETUP_NODE_VERSION,
    START_RUNNERS,
} from '#cli/config/repository/version-pin.ts';
import { OWNER_WRITABLE_FILE } from '#cli/config/system.ts';
import { parseJsonFile } from '#cli/parsers/formats/json.ts';
import { parseTomlFile } from '#cli/parsers/formats/toml.ts';
import { readLockedVersions } from '#cli/parsers/projects/lockfiles.ts';
import { readPackageJson } from '#cli/repository/dependencies.ts';
import { buildFrozenInstallArguments, detectPackageManager } from '#cli/repository/package-manager.ts';
import { packageJsonSchema } from '#cli/schemas/parsers.ts';
import { miseToolsSchema } from '#cli/schemas/repository.ts';
import { createRunCache } from '#cli/system/cache.ts';
import { GspotError } from '#cli/system/errors.ts';
import { findText } from '#cli/system/files/reads.ts';
import { findValueAt, isTable } from '#cli/system/tables.ts';
import { compareText } from '#cli/system/text.ts';
import type { SetupReference, StartRunner } from '#cli/types/repository.ts';
import type { Files } from '#cli/types/system.ts';

function readMisePin(root: string, tool: string): string | undefined {
    const text = findText(root, MISE_CONFIG_FILE);
    if (text === undefined) return undefined;
    const pin = findValueAt(parseTomlFile(MISE_CONFIG_FILE, text), ['tools', tool]);
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
*/
export function writeMisePin(writer: Files): void {
    const tools = writer.read(MISE_CONFIG_FILE);
    const text = tools?.bytes.toString('utf8') ?? '';
    const document = parseTomlFile(MISE_CONFIG_FILE, text, miseToolsSchema);
    const pin = { version: cliPackage.version, ...GSPOT_MISE_OPTIONS };
    const node = document.tools[NODE_TOOL] === undefined ? { [NODE_TOOL]: SETUP_NODE_VERSION } : {};
    const next = { ...document, tools: { ...node, ...document.tools, [GSPOT_MISE_TOOL]: pin } };
    const patched = patch(text, next);
    writer.write(MISE_CONFIG_FILE, {
        bytes: Buffer.from(patched.endsWith('\n') ? patched : `${patched}\n`),
        mode: tools?.mode ?? OWNER_WRITABLE_FILE,
    });
}

/**
Select the command that adds a package. pnpm refuses a plain add in the folder that holds its workspace file.
*/
export function selectInstallCommand(name: StartRunner['name'], folder: string): string {
    return name === 'pnpm' && existsSync(join(folder, PNPM_WORKSPACE_FILE))
        ? PNPM_WORKSPACE_INSTALL
        : START_RUNNERS[name].installCommand;
}

export function buildStartRunner(name: StartRunner['name'], root: string): StartRunner {
    const installCommand = selectInstallCommand(name, root).replace('<package>', () => cliPackage.name);
    return { name, ...START_RUNNERS[name], installCommand };
}

export function selectStartRunner(root: string): StartRunner {
    const name = readCliSpecifier(root) === undefined ? 'mise' : detectPackageManager(root, []).name;
    return buildStartRunner(name, root);
}

/**
List the commands that a mise pin needs before it. Without a Node.js pin, mise starts gspot with the Node.js of the
system, which can be too old to run it.
*/
export function listPinPrerequisites(root: string, runner: StartRunner['name']): string[] {
    if (runner !== 'mise') return [];
    const { tools } = parseTomlFile(MISE_CONFIG_FILE, findText(root, MISE_CONFIG_FILE) ?? '', miseToolsSchema);
    return tools[NODE_TOOL] === undefined ? [MISE_NODE_PIN_COMMAND] : [];
}

/**
Select the Node.js that CI runs gspot and the package managers with: the one that mise.toml pins, so CI runs what the
developers run, or the one that gspot is tested with when mise.toml pins none.
*/
export function readCiNode(root: string): string {
    const version = readMisePin(root, NODE_TOOL);
    return version === undefined ? CI_NODE : `${NODE_TOOL}@${version}`;
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

export function buildSetupReference(): SetupReference[] {
    return Object.entries(PACKAGE_MANAGER_LABELS).map(([name, label]) => {
        const runner = START_RUNNERS[name as keyof typeof START_RUNNERS];
        const lockfile = LOCKFILES.find((file) => file.packageManager === name && 'copied' in file)?.file;
        const prerequisites = name === 'mise' ? [MISE_NODE_PIN_COMMAND] : [];
        const add = runner.installCommand.replace('<package>@<version>', () => cliPackage.name);
        const frozen =
            lockfile === undefined
                ? []
                : [
                      name,
                      ...buildFrozenInstallArguments(
                          lockfile as keyof typeof FROZEN_INSTALLS,
                          String(YARN_BERRY_MAJOR) + '.0.0',
                      ),
                  ];
        return {
            name,
            label,
            start: runner.command,
            add,
            prerequisites,
            lines: [...prerequisites, add, `${runner.command} init`],
            clone: [
                ...(frozen.length === 0 ? [] : [frozen.join(' ')]),
                `${runner.command} install`,
                `${runner.command} check`,
            ],
        };
    });
}
