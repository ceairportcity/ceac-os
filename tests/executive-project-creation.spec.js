import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';

test('Executive navigation offers a Projects destination and existing creation action',()=>{
 const nav=readFileSync('src/experience-v2/shell/navigation.js','utf8');
 const app=readFileSync('src/App.jsx','utf8');
 const rpc=readFileSync('supabase/migrations/20261030235951_executive_project_creation.sql','utf8');
 expect(nav).toContain('{ key: "exec-projects", label: "Projects"');
 expect(app).toContain('if (tab === "exec-projects" && isExec)');
 expect(app).toContain('onCreateProject={isExec');
 expect(rpc).toContain('public.app_is_exec()');
 expect(rpc).toContain('public.app_is_admin()');
 expect(rpc).toContain('public.app_managed_units()');
 expect(rpc).toContain("v_org uuid:=public.app_org_id()");
 expect(rpc).toContain("insert into public.activity_events");
 const workforce=readFileSync('src/components/AdminWorkforceToday.jsx','utf8');
 expect(workforce).not.toContain('Browse {peopleLabel}');
});

test('Executive creates a department-led project through authorised workflow',async({page})=>{
 test.setTimeout(90000);
 const password=process.env.ROLE_FIXTURE_PASSWORD;
 test.skip(!password,'Requires the local role fixture.');
 await page.setViewportSize({width:1366,height:900});
 await page.goto('/');
 await page.getByPlaceholder('Work email').fill('exec@ceac.local.test');
 await page.getByPlaceholder('Password').fill(password);
 await page.getByRole('button',{name:'Sign in'}).click();
 await expect(page.locator('.executive-app')).toBeVisible({timeout:20000});
 await page.goto('/?tab=exec-projects');
 await expect(page.getByRole('heading',{name:'Projects',exact:true})).toBeVisible({timeout:20000});
 await page.getByRole('button',{name:'Create project',exact:true}).first().click();
 const name='Executive project verification '+Date.now();
 await page.getByLabel('Project name').fill(name);
 await page.getByLabel('Purpose').fill('Validate authenticated executive project creation without an HR role.');
 await page.getByLabel('Lead department').selectOption({index:1});
 await page.locator('form').filter({has:page.getByLabel('Project name')}).getByRole('button',{name:'Create project',exact:true}).click();
 // onCreated navigates only after the RPC succeeded and the saved project was reread.
 await expect(page).toHaveURL(/tab=exec-projects.*project=[0-9a-f-]{36}/i,{timeout:25000});
 await expect(page.getByRole('region',{name:'Project creation error'})).toHaveCount(0);
});
