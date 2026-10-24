// Local visual fixture only. Vite's production entry does not include this page.
import React from "react";
import {createRoot} from "react-dom/client";
import People from "../../src/screens/People";
import "../../src/styles.css";
import "../../src/experience-v2.css";
import "../../src/experience-v2/components/components.css";
const me={id:"00000000-0000-4000-8000-000000000001",org_id:"00000000-0000-4000-8000-000000000002",is_admin:true,capabilities:["people.manage"],capability_grants:[{capability:"people.manage",scope_unit_id:null}]};
createRoot(document.getElementById("root")).render(<People me={me} go={()=>{}} openItem={()=>{}} openLifecycle={()=>{}} />);
