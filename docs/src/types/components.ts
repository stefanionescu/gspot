import type starlight from '@astrojs/starlight';

export type FeatureProps = {
    title: string;
    description: string;
    features: { title: string; description: string; image: string; href: string; link: string }[];
};

/** Authored documentation navigation accepted by Starlight. */
export type Sidebar = NonNullable<Parameters<typeof starlight>[0]['sidebar']>;
