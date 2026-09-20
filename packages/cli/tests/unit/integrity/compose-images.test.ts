import { expect, test } from 'bun:test';
import { composeImages } from '#cli/integrity/docker/image-scan.ts';

test('the image scan reads the images a Compose file names, and skips one that comes from a variable', () => {
    const compose =
        'services:\n    proxy:\n        image: "nginx:1.27.2"\n    api:\n        image: ${API_IMAGE}\n    cache:\n        image: redis:7.4.1 # pinned\n';
    expect(composeImages(compose)).toEqual(['nginx:1.27.2', 'redis:7.4.1']);
});
