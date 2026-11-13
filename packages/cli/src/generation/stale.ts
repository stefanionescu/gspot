import { createTwoFilesPatch } from 'diff';

import { DIFF_CONTEXT_LINES, ON_DISK_LABEL } from '#cli/config/generation/files.ts';
import { OCTAL_RADIX } from '#cli/config/system.ts';
import { planGeneratedWrites } from '#cli/generation/write.ts';
import { findBlockSpan } from '#cli/parsers/formats/managed-blocks.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { compareText } from '#cli/system/text/order.ts';
import { listStaleLockfiles } from '#cli/tools/installers/projects.ts';
import type { StaleFile } from '#cli/types/engine/run.ts';
import type { WritePlan } from '#cli/types/repository.ts';
import type { FileContents, Files } from '#cli/types/system.ts';
import type { Generation, Session } from '#cli/types/tools.ts';

function buildPlanDiff({ path, after }: WritePlan, onDisk: FileContents): string | undefined {
    if (after === undefined) return undefined;
    if (after.bytes.equals(onDisk.bytes))
        return `old mode ${onDisk.mode.toString(OCTAL_RADIX)}\nnew mode ${after.mode.toString(OCTAL_RADIX)}\n`;
    return createTwoFilesPatch(
        `a/${convertToPosixPath(path)}`,
        `b/${convertToPosixPath(path)}`,
        onDisk.bytes.toString('utf8'),
        after.bytes.toString('utf8'),
        ON_DISK_LABEL,
        'generated',
        { context: DIFF_CONTEXT_LINES },
    );
}

function buildStaleWrite(files: Files, plan: WritePlan, options: { verbose?: boolean | undefined }): StaleFile {
    const onDisk = files.read(plan.path);
    if (onDisk === undefined) return { path: plan.path, kind: 'absent' };
    const diff = options.verbose === true ? buildPlanDiff(plan, onDisk) : undefined;
    return { path: plan.path, kind: 'changed', ...(diff !== undefined && { diff }) };
}

/**
List each generated file that `gspot install` changes, from the write plan of the install. A plan that the install
refuses counts as changed, because the file on disk differs from the generated one.
*/
export function listStaleFiles(
    session: Session,
    generated: Generation,
    options: { verbose?: boolean | undefined } = {},
): StaleFile[] {
    const files = openFiles(session.root);
    const plans = planGeneratedWrites(session, generated, files);
    const stale: StaleFile[] = [
        ...listStaleLockfiles(session, generated.files).map(({ path, kind }) => ({ path, kind })),
        ...plans.replacements
            .filter((plan) => plan.status !== 'unchanged')
            .map((plan) => buildStaleWrite(files, plan, options)),
        ...plans.blocks
            .filter((plan) => plan.status !== 'unchanged')
            .map((plan): StaleFile => {
                const text = files.read(plan.path)?.bytes.toString('utf8') ?? '';
                return findBlockSpan(text, plan.path) === undefined
                    ? { path: plan.path, kind: 'absent' }
                    : buildStaleWrite(files, plan, options);
            }),
        ...plans.managedKeys
            .filter((plan) => plan.status !== 'unchanged')
            .map(({ path }): StaleFile => ({ path, kind: files.read(path) === undefined ? 'absent' : 'changed' })),
        ...plans.removals
            .filter((plan) => plan.status !== 'unchanged')
            .map(({ path }): StaleFile => ({ path, kind: 'stray' })),
    ];
    return stale.toSorted((a, b) => compareText(a.path, b.path));
}
