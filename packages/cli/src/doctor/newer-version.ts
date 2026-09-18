// The one network lookup: is there a newer gspot? Only when a person runs doctor, init or upgrade --check.
import semver from 'semver';
import latestVersion from 'latest-version';

const LOOKUP_TIMEOUT_MS = 3000;

/**
 * The newer version on npm, or undefined when none or offline. Never throws.
 * @param current the running version
 * @returns the newer version
 */
export async function newerVersion(current: string): Promise<string | undefined> {
    try {
        const found = await Promise.race([
            latestVersion('gspot'),
            new Promise<undefined>((settle) =>
                setTimeout(() => {
                    settle(undefined);
                }, LOOKUP_TIMEOUT_MS),
            ),
        ]);
        if (found === undefined) return undefined;
        return semver.gt(found, current) ? found : undefined;
    } catch {
        return undefined;
    }
}
