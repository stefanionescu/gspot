import { test, expect } from 'bun:test';
import { buildTrackedFile } from '#tests/harness/tracked.ts';
import { detectConfigurations } from '#cli/configurations/detect.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';

test('proposes a language from an extension and the defaults for every repository', () => {
    const plans = detectConfigurations([buildTrackedFile('a.sh')], configurationManifests(), []);
    expect(plans.find((plan) => plan.configuration === 'bash')?.evidence).toBe('1 .sh file');
    expect(plans.some((plan) => plan.configuration === 'spelling')).toBe(true);
});
