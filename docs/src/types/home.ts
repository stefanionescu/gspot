export type FeatureProps = {
    title: string;
    description: string;
    features: readonly { title: string; description: string; image: string; href: string; link: string }[];
};
