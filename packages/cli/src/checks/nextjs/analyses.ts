// The nextjs analyses, by the name a manifest check gives them.
import type { Engine } from '#cli/types/checks.ts';
import { nextjsBuild, nextjsTypes } from '#cli/checks/nextjs/build.ts';
import { routeSegments, dependencyAlignment, nextjsConfiguration } from '#cli/checks/nextjs/source.ts';

export const NEXTJS_ANALYSES: Record<string, Engine> = {
    'next-route-segments': routeSegments,
    'next-config': nextjsConfiguration,
    'next-types': nextjsTypes,
    'next-build': nextjsBuild,
    'dependency-alignment': dependencyAlignment,
};
