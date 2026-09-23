import { parseCarrySource } from '#cli/lifecycle/carry-source.ts';
import { carryFormat } from '#cli/lifecycle/format-evaluation.ts';
import type { CarriedConfiguration } from '#cli/lifecycle/types.ts';
import { policySchema } from '#cli/policy/schema.ts';
import type { ExistingTooling } from '#cli/repository/types.ts';
import { parseBuffer } from 'editorconfig';
import { basename, dirname } from 'node:path';

/** Convert observed formatter and EditorConfig settings before proposing retirement. */
export async function collectFormatting(
    root: string,
    configs: ExistingTooling['configs'],
    lists: CarriedConfiguration,
): Promise<void> {
    const [first] = configs;
    if (first === undefined) return;
    try {
        const unsupported = configs.find(({ carries, path }) => carries === 'ignore-paths' && path.includes('/'));
        if (unsupported !== undefined)
            throw new Error(
                `Formatting conversion does not support ${unsupported.path}. Its configuration remains intact.`,
            );
        const format = configs.filter(({ tool, carries }) => tool === 'prettier' && carries !== 'ignore-paths');
        const editorconfigs = configs.filter(({ tool }) => tool === 'ec');
        const editorconfig = editorconfigs.find(({ path }) => !path.includes('/'));
        const document = (path: string) => {
            const sections = parseBuffer(lists.observed.get(path)!.bytes);
            return {
                preamble: sections.find(([glob]) => glob === null)?.[1] ?? {},
                sections: sections
                    .filter(([glob]) => glob !== null)
                    .map(([glob, properties]) => ({ glob, properties })),
            };
        };
        const adopted =
            editorconfigs.length === 0
                ? undefined
                : policySchema.shape.tools
                      .unwrap()
                      .shape.editorconfig.unwrap()
                      .shape.adopted.unwrap()
                      .parse({
                          ...(editorconfig === undefined
                              ? { preamble: {}, sections: [] }
                              : document(editorconfig.path)),
                          directories: editorconfigs
                              .filter(({ path }) => path.includes('/'))
                              .map(({ path }) => ({
                                  basePath: dirname(path).replaceAll('\\', '/'),
                                  ...document(path),
                              })),
                      });
        const folders = new Set(format.map(({ path }) => dirname(path)));
        if (folders.size !== format.length)
            throw new Error('Multiple Prettier configurations in one directory require explicit conversion.');
        const sources = format.map((input) => ({
            from: input.path,
            ...(/\.[cm]?[jt]s$/u.test(input.path) || /^package\./u.test(basename(input.path))
                ? {}
                : { source: parseCarrySource(lists.observed.get(input.path)!, input.tool, input.path) }),
        }));
        lists.formatter = await carryFormat(
            root,
            sources,
            configs.find(({ carries }) => carries === 'ignore-paths')?.path,
            adopted !== undefined,
        );
        if (adopted !== undefined) {
            lists.formatter.nativeDefaults = true;
            lists.formatter.editorconfig = adopted;
        }
        for (const { path } of configs) {
            if (/^package\./u.test(basename(path)))
                lists.retained.push({
                    path,
                    note: 'Package metadata retained; formatter options and selectors are represented in gspot configuration',
                });
            else
                lists.removed.push({
                    path,
                    note: 'Formatting options and ordered selectors are represented in gspot configuration',
                });
        }
    } catch (error) {
        lists.unread.push({ path: first.path, note: `not read and not deleted: ${(error as Error).message}` });
    }
}
