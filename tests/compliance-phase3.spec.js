import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

test("Phase 3 Compliance overview stays factual and capability-separated", () => {
  const screen = readFileSync("src/screens/Compliance.jsx", "utf8");
  const overview = readFileSync("src/components/ComplianceOverview.jsx", "utf8");
  const announcements = readFileSync("src/screens/Announcements.jsx", "utf8");
  const app = readFileSync("src/App.jsx", "utf8");

  expect(screen).toContain('["overview","Overview"]');
  expect(screen).toContain('rpc("attendance_day_evidence"');
  expect(overview).toContain("No session recorded");
  expect(overview).toContain("is not an absence or misconduct finding");
  expect(overview).toContain("do not calculate compliance, guilt, performance or disciplinary outcomes");
  expect(overview).not.toMatch(/unexplained absence/i);
  expect(announcements).toContain('grant.capability === "post_announcement" && !grant.scope_unit_id');
  expect(announcements).not.toContain('from("capabilities")');
  expect(app).toContain('hasOrgCapability("post_announcement")');
});
