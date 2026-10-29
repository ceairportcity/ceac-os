import { test, expect } from "@playwright/test";

const password=process.env.ROLE_FIXTURE_PASSWORD;

const roleRoutes={
  staff:{
    email:"staff@ceac.local.test",
    app:".staff-app",
    routes:[
      ["home","home"],["work","work"],["team","team"],["staff-calendar","calendar"],
      ["messages","messages"],["me","my-hub"],["record","record"],["announcements","announcements"],
      ["performance","performance"],["learning","learning"],["attendance","workforce"],
      ["assets","assets"],["compliance","compliance"],["account","account"]
    ]
  },
  manager:{
    email:"manager@ceac.local.test",
    app:".manager-app",
    routes:[
      ["home","home"],["work","work"],["team","team"],["projects","projects"],["calendar","calendar"],
      ["manager-finance","budget"],["manager-reports","reports"],["record","record"],["announcements","announcements"],
      ["strategy","strategy"],["delivery","delivery"],["workload","workload"],["performance","performance"],
      ["learning","learning"],["attendance","workforce"],["assets","assets"],["compliance","compliance"],
      ["messages","messages"],["me","my-hub"],["account","account"]
    ]
  },
  administration:{
    email:"admin@ceac.local.test",
    app:".office-app",
    routes:[
      ["home","home"],["people","people"],["work","work"],["attendance","workforce"],["finance","finance"],
      ["cost","expenses"],["reporting","reports"],["units","units"],["admin-projects","projects"],
      ["admin-calendar","calendar"],["lifecycle","lifecycle"],["protected-hr","protected-hr"],["audit","audit"],
      ["events","events"],["workflows","workflows"],["policies","policies"],["integrations","integrations"],
      ["authority","authority"],["office-settings","organisation-settings"],["settings","control-center"],
      ["payroll","payroll"],["messages","messages"],["me","my-hub"],["account","account"],["record","record"],["announcements","announcements"]
    ]
  },
  executive:{
    email:"exec@ceac.local.test",
    app:".executive-app",
    routes:[
      ["home","home"],["work","work"],["strategy","ministry"],["delivery","portfolio"],
      ["exec-organisation","organisation"],["exec-finance","finance"],["exec-reports","reports"],
      ["payroll","payroll"],["messages","messages"],["me","my-hub"],["account","account"],["record","record"],["announcements","announcements"]
    ]
  }
};

async function signIn(page,email,app){
  await page.goto("/");
  await page.getByPlaceholder("Work email").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button",{name:"Sign in"}).click();
  await expect(page.locator(app)).toBeVisible({timeout:15000});
}

async function inspectRoutes(page,role,config,routes){
  const tinyText=[];
  for(const [tab,label] of routes){
    const url=tab==="home"?"/":"/?tab="+encodeURIComponent(tab);
    await page.goto(url);
    await expect(page.locator(config.app)).toBeVisible({timeout:15000});
    await expect(page.locator(".app-content")).toBeVisible();
    await expect(page.locator(tab === "messages" ? ".msg-workspace" : ".body").first()).toBeVisible({timeout:15000});
    await page.evaluate(()=>document.fonts.ready);
    await page.waitForTimeout(250);
    const sidebarOverflow=await page.evaluate(()=>{
      const side=document.querySelector(".ev2s-sidebar");
      return side ? side.scrollWidth-side.clientWidth : 0;
    });
    expect(sidebarOverflow, role+" / "+label+" sidebar horizontal overflow").toBeLessThanOrEqual(1);
    const violations=await page.evaluate(()=>{
      const visible=(el)=>{
        const style=getComputedStyle(el);
        const rect=el.getBoundingClientRect();
        return style.display!=="none"&&style.visibility!=="hidden"&&Number(style.opacity)!==0&&rect.width>0&&rect.height>0;
      };
      return [...document.querySelectorAll(".app-content *, .ev2s-sidebar *, .ev2s-topbar *, .ev2s-mobile-nav *")]
        .filter((el)=>visible(el)&&[...el.childNodes].some((node)=>node.nodeType===Node.TEXT_NODE&&node.textContent.trim()))
        .map((el)=>({tag:el.tagName.toLowerCase(),className:String(el.className||"").slice(0,100),parentClassName:String(el.parentElement?.className||"").slice(0,100),grandparentClassName:String(el.parentElement?.parentElement?.className||"").slice(0,100),text:(el.textContent||"").trim().replace(/\s+/g," ").slice(0,80),size:parseFloat(getComputedStyle(el).fontSize)||0}))
        .filter((item)=>item.text&&item.size>0&&item.size<12);
    });
    tinyText.push(...violations.map((item)=>({route:label,...item})));
    await page.screenshot({path:"test-artifacts/visual-parity-"+role+"-"+label+".png",fullPage:true});
  }
  return tinyText;
}

async function inspectMobileRoutes(page,role,config,routes){
  for(const [tab,label] of routes){
    const url=tab==="home"?"/":"/?tab="+encodeURIComponent(tab);
    await page.goto(url);
    await expect(page.locator(config.app)).toBeVisible({timeout:15000});
    await expect(page.locator(tab === "messages" ? ".msg-workspace" : ".body").first()).toBeVisible({timeout:15000});
    await page.evaluate(()=>document.fonts.ready);
    const geometry=await page.evaluate(()=>{
      const body=document.querySelector(new URL(location.href).searchParams.get("tab")==="messages" ? ".app-content .msg-workspace" : ".app-content .body");
      const rect=body?.getBoundingClientRect();
      return {
        document:document.documentElement.scrollWidth-document.documentElement.clientWidth,
        bodyRight:rect ? rect.right-window.innerWidth : 0,
        bodyLeft:rect ? -rect.left : 0,
      };
    });
    expect(geometry.document, role+" / "+label+" mobile document overflow").toBeLessThanOrEqual(1);
    expect(geometry.bodyRight, role+" / "+label+" mobile body overflow right").toBeLessThanOrEqual(1);
    expect(geometry.bodyLeft, role+" / "+label+" mobile body overflow left").toBeLessThanOrEqual(1);
  }
}

for(const [role,config] of Object.entries(roleRoutes)){
  const routeGroups=role==="administration"
    ? [config.routes.slice(0,10),config.routes.slice(10)]
    : [config.routes];

  routeGroups.forEach((routes,index)=>{
    const suffix=routeGroups.length>1 ? " "+(index+1) : "";
    test(role+" visual inventory"+suffix,async({page})=>{
      // Full role sweeps navigate 10–26 routes; preserve every assertion while
      // giving complete authenticated loading/rendering the necessary time.
      test.setTimeout(Math.max(90000, routes.length * 7500));
      await page.setViewportSize({width:1440,height:960});
      await signIn(page,config.email,config.app);
      const tinyText=await inspectRoutes(page,role,config,routes);
      expect(tinyText, "Visible text below the CEAC 12px operational floor").toEqual([]);
    });

    test(role+" mobile route sweep"+suffix,async({page})=>{
      test.setTimeout(Math.max(90000, routes.length * 7500));
      await page.setViewportSize({width:390,height:844});
      await signIn(page,config.email,config.app);
      await inspectMobileRoutes(page,role,config,routes);
      await page.screenshot({path:"test-artifacts/ocr5h-"+role+"-mobile-"+(index+1)+".png",fullPage:true});
    });

  });

  test(role+" laptop shell has no horizontal overflow",async({page})=>{
    await page.setViewportSize({width:1366,height:768});
    await signIn(page,config.email,config.app);
    await page.goto("/");
    await expect(page.locator(config.app)).toBeVisible({timeout:15000});
    await page.evaluate(()=>document.fonts.ready);
    const overflow=await page.evaluate(()=>{
      const side=document.querySelector(".ev2s-sidebar");
      return {
        document:document.documentElement.scrollWidth-document.documentElement.clientWidth,
        side:side ? side.scrollWidth-side.clientWidth : 0,
        brand:side?.querySelector(".ev2s-brand")
          ? side.querySelector(".ev2s-brand").scrollWidth-side.querySelector(".ev2s-brand").clientWidth
          : 0,
      };
    });
    expect(overflow.document, role+" laptop document overflow").toBeLessThanOrEqual(1);
    expect(overflow.side, role+" laptop sidebar overflow").toBeLessThanOrEqual(1);
    expect(overflow.brand, role+" laptop brand overflow").toBeLessThanOrEqual(1);
  });
}
