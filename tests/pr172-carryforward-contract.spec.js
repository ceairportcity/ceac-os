import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

test("Executive planning uses clear labels without changing its route key or data model", () => {
  const nav = readFileSync("src/experience-v2/shell/navigation.js","utf8");
  const strategy = readFileSync("src/screens/Strategy.jsx","utf8");
  expect(nav).toContain('key: "strategy", label: "Priorities"');
  for (const label of ['Church priority','Church goal','Department goal']) expect(strategy).toContain(label);
  for (const type of ['ministry_direction','ministry_objective','unit_objective']) expect(strategy).toContain(type);
});

test("Project task rows have readable phone labels and desktop table preserved", () => {
  const jsx = readFileSync("src/components/Stage2ProjectOverview.jsx","utf8");
  const css = readFileSync("src/components/Stage2ProjectOverview.css","utf8");
  expect(jsx).toContain('aria-label="Project tasks and responsibilities"');
  for (const label of ['Task','Department','Assigned to','Due','Status']) {
    expect(jsx).toContain('data-label="' + label + '"');
  }
  expect(css).toContain('content:attr(data-label)');
  expect(css).toContain('@media(max-width:640px)');
  expect(jsx).toContain('onClick={() => openWork?.(item.id)}');
});
