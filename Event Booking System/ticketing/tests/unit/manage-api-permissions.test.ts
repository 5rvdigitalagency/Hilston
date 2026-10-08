import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const routes: Record<string, string> = {
  "src/app/api/manage/bookings/route.ts": "bookings.view",
  "src/app/api/manage/bookings/[bookingId]/route.ts": "payments.manage",
  "src/app/api/manage/check-in/options/route.ts": "check_in.manage",
  "src/app/api/manage/notifications/route.ts": "events.manage",
  "src/app/api/manage/operations/route.ts": "reports.sales.view",
  "src/app/api/manage/summary/route.ts": "events.manage",
  "src/app/api/manage/ticket-preview/route.ts": "events.manage",
};

describe("manage API permission contract", () => {
  it.each(Object.entries(routes))("requires %s", async (routePath, permission) => {
    const source = await readFile(join(root, routePath), "utf8");
    expect(source).toContain("isStaffSession");
    expect(source).toContain(permission);
    expect(source).toMatch(/status:\s*(401|403)/);
  });
});
