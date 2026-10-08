import type { MetadataRoute } from "next";
import { publicEventsOrigin } from "@/lib/event-publishing";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/events"],
      disallow: ["/"],
    },
    sitemap: `${publicEventsOrigin()}/sitemap.xml`,
  };
}
