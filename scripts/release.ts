// Refuse an invalid release tag before CI or publication starts.
import semver from 'semver';
import cliPackage from '#cli-package' with { type: 'json' };
import { ARGUMENT_START } from '#automation/config/paths.ts';
import pluginPackage from '#plugin-package' with { type: 'json' };
import { configurationManifests } from '#cli/configurations/public.ts';

const tag = process.argv[ARGUMENT_START];
const version = semver.parse(cliPackage.version);
if (version?.version !== cliPackage.version || version.prerelease.length > 0)
    throw new Error('The CLI release version must be an exact stable semantic version.');
if (tag !== `v${version.version}`) throw new Error(`Start the release on the version tag v${version.version}.`);
const pluginVersion = semver.parse(pluginPackage.version);
if (pluginVersion?.version !== pluginPackage.version || pluginVersion.prerelease.length > 0)
    throw new Error('The ESLint plugin release version must be an exact stable semantic version.');
const javascript = configurationManifests().get('javascript');
const pin = javascript?.tools.find((tool) => tool.name === pluginPackage.name);
if (pin?.version !== pluginPackage.version || pin.installers['npm']?.version !== pluginPackage.version)
    throw new Error('The JavaScript configuration must pin the ESLint plugin version being released.');
console.log(`Validated ${tag} and ${pluginPackage.name}@${pluginPackage.version}.`);
