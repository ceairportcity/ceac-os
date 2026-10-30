import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';

test('Executive has a dedicated Projects route and retained project-creation security',async()=>{
 const nav=readFileSync('src/experience-v2/shell/navigation.js','utf8');
 const app=readFileSync('src/App.jsx','utf8');
 const migration=readFileSync('supabase/migrations/20261030231000_executive_project_creation.sql','utf8');
 expect(nav).toContain('{ key: "exec-projects", label: "Projects"');
 expect(nav).toContain('{ key: "delivery", label: "Portfolio"');
 expect(app).toContain('tab === "exec-projects" && isExec');
 expect(app).toContain('<AdminProjects key={`${me.org_id}:${me.id}:executive-projects`}');
 expect(migration).toContain('public.app_is_exec()');
 expect(migration).toContain("c.capability='create_project'");
 expect(migration).toContain('public.app_managed_units()');
 expect(migration).toContain('public.app_is_admin()');
});

test('Executive Projects navigation offers project creation',async({page})=>{
 test.skip(!process.env.ROLE_FIXTURE_PASSWORD,'Requires local role fixtures');
 await page.goto('/');
 await page.getByPlaceholder('Work email').fill('exec@ceac.local.test');
 await page.getByPlaceholder('Password').fill(process.env.ROLE_FIXTURE_PASSWORD);
 await page.getByRole('button',{name:'Sign in'}).click();
 await expect(page.locator('.executive-app')).toBeVisible();
 await page.goto('/?tab=exec-projects');
 await expect(page.getByRole('heading',{name:'Projects',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Create project'})).toBeVisible();
 await page.getByRole('button',{name:'Create project'}).click();
 await expect(page.getByRole('heading',{name:'Create project'})).toBeVisible();
 await expect(page.getByLabel('Lead department')).toBeVisible();
});

test('Staff does not gain Executive project access through a direct URL',async({page})=>{
 test.skip(!process.env.ROLE_FIXTURE_PASSWORD,'Requires local role fixtures');
 await page.goto('/');
 await page.getByPlaceholder('Work email').fill('staff@ceac.local.test');
 await page.getByPlaceholder('Password').fill(process.env.ROLE_FIXTURE_PASSWORD);
 await page.getByRole('button',{name:'Sign in'}).click();
 await expect(page.locator('.staff-app')).toBeVisible();
 await page.goto('/?tab=exec-projects');
 await expect(page.getByRole('button',{name:'Create project',exact:true})).toHaveCount(0);
 await expect(page.locator('.staff-app')).toBeVisible();
});
