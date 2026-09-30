// The xcode analyses, by the name a manifest check gives them.
import type { Engine } from '#cli/types/checks.ts';
import { stringFiles, assetFolders } from '#cli/checks/xcode/resources.ts';
import { testPlans, orphanSources, projectSymlinks } from '#cli/checks/xcode/project/checks.ts';
import { xcconfigLines, transportSecurity, entitlementsPolicy } from '#cli/checks/xcode/settings-files.ts';

export const XCODE_ANALYSES: Record<string, Engine> = {
    'xcode-xcconfig': xcconfigLines,
    'xcode-entitlements': entitlementsPolicy,
    'xcode-ats': transportSecurity,
    'xcode-xcstrings': stringFiles,
    'xcode-assets': assetFolders,
    'xcode-test-plans': testPlans,
    'xcode-orphan-sources': orphanSources,
    'xcode-symlinks': projectSymlinks,
};
