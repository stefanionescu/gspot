import { SWIFT_SIX_PREFIX, STRICT_CONCURRENCY } from '#cli/config/parsers/projects.ts';
import { getElement, parsePbxproj, buildProjectParseError } from '#cli/parsers/projects/xcode/document.ts';
import type { PbxElement, ParsedPbxproj, ProjectBuildTarget, ProjectBuildSettings } from '#cli/types/parsers.ts';

function listConfigurations(project: ParsedPbxproj, list: string | undefined): PbxElement[] {
    const configurations = list === undefined ? [] : (getElement(project, list).buildConfigurations ?? []);
    return configurations.map((configuration) => getElement(project, configuration));
}

function isStrictConfiguration(project: ParsedPbxproj, list: string | undefined): boolean {
    const shared = listConfigurations(project, project.root.buildConfigurationList);
    return listConfigurations(project, list).every((configuration) => {
        if (configuration.baseConfigurationReference !== undefined) return true;
        const inherited = shared.find((each) => each.name === configuration.name)?.buildSettings;
        const settings = { ...inherited, ...configuration.buildSettings };
        return (
            settings.SWIFT_STRICT_CONCURRENCY === STRICT_CONCURRENCY ||
            settings.SWIFT_VERSION?.startsWith(SWIFT_SIX_PREFIX) === true
        );
    });
}

export function parseBuildTargets(text: string, path: string): ProjectBuildTarget[] {
    const project = parsePbxproj(text, path);
    try {
        return (project.root.targets ?? []).flatMap((id) => {
            const target = getElement(project, id);
            if (target.isa !== 'PBXNativeTarget') return [];
            const phases = (target.buildPhases ?? []).map((phaseId) => getElement(project, phaseId));
            return [
                {
                    name: target.name ?? id,
                    isStrict: isStrictConfiguration(project, target.buildConfigurationList),
                    scripts: phases
                        .filter((phase) => phase.isa === 'PBXShellScriptBuildPhase')
                        .map((phase) => ({
                            name: phase.name ?? 'Run Script',
                            script: phase.shellScript ?? '',
                            hasFiles: [
                                phase.inputPaths,
                                phase.outputPaths,
                                phase.inputFileListPaths,
                                phase.outputFileListPaths,
                            ].some((paths) => paths !== undefined && paths.length > 0),
                        })),
                },
            ];
        });
    } catch (error) {
        throw buildProjectParseError(path, error);
    }
}

export function parseBuildSettings(text: string, path: string): ProjectBuildSettings {
    const project = parsePbxproj(text, path);
    const settings = Object.values(project.objects).flatMap((record) => record.buildSettings ?? []);
    return {
        sdkRoot: settings.find((setting) => setting.SDKROOT !== undefined)?.SDKROOT,
        swiftVersion: settings.find((setting) => setting.SWIFT_VERSION !== undefined)?.SWIFT_VERSION,
    };
}
