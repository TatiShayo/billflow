import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: "https://billflow.app", lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: "https://billflow.app/pricing", lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: "https://billflow.app/login", lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: "https://billflow.app/signup", lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
  ];
}
