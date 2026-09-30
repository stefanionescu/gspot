// The docker analyses, by the name a manifest check gives them.
import type { Engine } from '#cli/types/checks.ts';
import { trivyImage } from '#cli/checks/docker/image-scan.ts';
import { dockerignore } from '#cli/checks/docker/ignore-file.ts';

export const DOCKER_ANALYSES: Record<string, Engine> = {
    dockerignore,
    'trivy-image': trivyImage,
};
