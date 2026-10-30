import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { openFiles } from '#cli/system/files/open.ts';
import { openSession } from '#cli/planning/session.ts';
import { buildToolInstall } from '#tests/setup/cli/tools.ts';
import { explainReleaseAgeHold } from '#cli/installers/steps.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';

test('a resolution that names a pinned tool explains the release-age hold', async () => {
    await using sandbox = await testdir({ 'gspot.toml': buildSandboxSettings([]) });
    const writer = openFiles(sandbox.path);
    const install = buildToolInstall(await openSession(sandbox.path), writer);
    const output = 'npm error notarget No matching version found for eslint@10.13.0 with a date before 10/23/2026.';
    expect(explainReleaseAgeHold(install, output, ['eslint@10.13.0', 'prettier@3.8.1'])).toBe(
        'eslint@10.13.0 came out less than 7 days ago. The setting dependencies.min_release_age_days holds back each release for 7 days. Wait for the release to age, or lower the setting with gspot set dependencies.min_release_age_days <days> --reason "<why>".\n',
    );
    expect(explainReleaseAgeHold(install, 'HTTP 403 Forbidden', ['eslint@10.13.0'])).toBe('');
    expect(explainReleaseAgeHold({ ...install, releaseAgeDays: 0 }, output, ['eslint@10.13.0'])).toBe('');
});
