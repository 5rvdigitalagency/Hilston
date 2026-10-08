import type { MetadataRoute } from "next";
import { publicEventsOrigin } from "@/lib/event-publishing";

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = publicEventsOrigin();
  return [{ url: `${origin}/events`, changeFrequency: "daily", priority: 0.8 }];
}
