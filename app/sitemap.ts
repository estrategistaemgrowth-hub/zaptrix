import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/landing-plans';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/assinar`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE_URL}/llms.txt`, changeFrequency: 'monthly', priority: 0.3 },
  ];
}
