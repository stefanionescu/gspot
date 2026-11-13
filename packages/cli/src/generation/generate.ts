import cliPackage from '#cli-package' with { type: 'json' };
import {
    ATTRIBUTE_GLOB_CHARACTERS,
    ATTRIBUTE_QUOTED_CHARACTERS,
    CI_SYSTEMS_SETTING,
    GIT_ATTRIBUTES_BLOCK,
    INSTALLED_TOOL_FOLDERS,
} from '#cli/config/generation/files.ts';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { FILTER_ATTRIBUTE, GITATTRIBUTES_FILE, LFS_FILTER } from '#cli/config/repository/files.ts';
import { AGENTS_FILE } from '#cli/config/repository/setup.ts';
import { GSPOT_FOLDER } from '#cli/config/system.ts';
import { buildBunScannerEdits } from '#cli/configurations/general/dependencies/bunfig.ts';
import { buildAgentsBlock, hasTopHeading } from '#cli/generation/builders/agents.ts';
import {
    buildGithubWorkflow,
    buildGitlabWorkflow,
    listProjectInstallLines,
    listTestChecks,
    readCiNode,
} from '#cli/generation/builders/ci.ts';
import { buildHookFiles } from '#cli/generation/builders/hooks.ts';
import { selectRuleFiles } from '#cli/generation/builders/rules.ts';
import { buildConfigs } from '#cli/generation/configs/build.ts';
import { listWrittenPaths } from '#cli/generation/configs/paths.ts';
import { buildPointerFieldEdits } from '#cli/generation/configs/pointers.ts';
import { stripBlock } from '#cli/parsers/formats/managed-blocks.ts';
import { ciFields } from '#cli/schemas/settings/tables.ts';
import { buildAvailableSettings } from '#cli/settings/available.ts';
import { listSelectedConfigurations } from '#cli/settings/scopes.ts';
import { getSettingValue } from '#cli/settings/values/inherit.ts';
import { findText } from '#cli/system/files/reads.ts';
import { compareText } from '#cli/system/text/order.ts';
import { listHookNames } from '#cli/tools/installers/hooks.ts';
import { buildToolProjects } from '#cli/tools/projects.ts';
import type { ConfigTargets } from '#cli/types/engine/tool-runs.ts';
import type { RuleFile } from '#cli/types/generation.ts';
import type { Generation, Session } from '#cli/types/tools.ts';

function addWorkflow(session: Session, generated: Generation): void {
    const { settings, scopes } = session;
    if (settings.ci?.enabled !== true) return;
    const available = buildAvailableSettings(listSelectedConfigurations(scopes), settings.level);
    const operatingSystems = ciFields.operating_systems
        .unwrap()
        .parse(getSettingValue(available, settings, CI_SYSTEMS_SETTING, '')?.value);
    generated.files.push(
        (settings.ci.provider === 'github' ? buildGithubWorkflow : buildGitlabWorkflow)({
            version: cliPackage.version,
            node: readCiNode(session.root),
            packageManager: session.packageManager,
            setupCommand: settings.ci.setup_command,
            projectInstall: settings.ci.setup_command === undefined ? listProjectInstallLines(session) : [],
            operatingSystems,
            linuxRunner: settings.ci.linux_runner,
            testChecks: listTestChecks(session),
        }),
    );
}

function formatAttributePath(path: string): string {
    const escaped = path.replaceAll(ATTRIBUTE_GLOB_CHARACTERS, (character) => `\\${character}`);
    const pattern = `/${escaped}`;
    if (!ATTRIBUTE_QUOTED_CHARACTERS.test(pattern)) return pattern;
    const quoted = pattern.replaceAll('\\', '\\\\').replaceAll('"', String.raw`\"`);
    return `"${quoted}"`;
}

function addManagedBlocks(session: Session, rules: RuleFile[], generated: Generation, configs: ConfigTargets): void {
    const { settings, cache } = session;
    const generatedLines = listWrittenPaths(session, configs).map(
        (path) => `${formatAttributePath(path)} linguist-generated`,
    );
    generated.blocks.push({ path: GITATTRIBUTES_FILE, body: [GIT_ATTRIBUTES_BLOCK, ...generatedLines].join('\n') });
    if (!settings.rule_files.enabled) return;
    const agents = findText(cache, AGENTS_FILE) ?? '';
    const agentsText = stripBlock(agents, AGENTS_FILE);
    const block = buildAgentsBlock({
        hasOwnTitle: hasTopHeading(agentsText),
        startCommand: session.startRunner.command,
        hooksEnabled: settings.hooks.enabled,
        files: rules,
    });
    generated.blocks.push({ path: AGENTS_FILE, body: block });
}

export function buildGeneratedFiles(session: Session): Generation {
    const { settings } = session;
    const generated: Generation = {
        files: [
            {
                path: GSPOT_PATHS.gitignore,
                content: Object.values(INSTALLED_TOOL_FOLDERS)
                    .map((folder) => `${folder.slice(GSPOT_FOLDER.length + 1)}/\n`)
                    .join(''),
            },
        ],
        blocks: [],
        managedKeys: [],
    };
    const configs = buildConfigs(session);
    const [failure] = configs.failures.values().flatMap((failures) => failures.values());
    if (failure !== undefined) throw failure;
    generated.files.push(...configs.files);
    generated.managedKeys.push(
        ...buildBunScannerEdits(session),
        ...buildPointerFieldEdits(session, generated.files, configs),
    );
    generated.files.push(
        ...(settings.hooks.enabled
            ? buildHookFiles(session.startRunner, listHookNames(session.configuredChecks), {
                  hasLfsFiles: session.repository.attributes
                      .values()
                      .some((attributes) => attributes[FILTER_ATTRIBUTE] === LFS_FILTER),
              })
            : []),
        ...buildToolProjects(session),
    );
    addWorkflow(session, generated);
    const rules = selectRuleFiles(session);
    generated.files.push(...rules.map(({ target: path, content }) => ({ path, content })));
    addManagedBlocks(session, rules, generated, configs);
    generated.files = generated.files.toSorted((left, right) => compareText(left.path, right.path));
    return generated;
}
