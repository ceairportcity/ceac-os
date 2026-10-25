import React from 'react';
import {createRoot} from 'react-dom/client';
import Compliance from '../../src/screens/Compliance';
import {SideNav,AppTopBar} from '../../src/experience-v2/shell/ShellV2';
import '../../src/styles.css';import '../../src/premium.css';import '../../src/premium-staff.css';import '../../src/premium-manager.css';import '../../src/premium-admin.css';import '../../src/premium-executive.css';import '../../src/premium-parity.css';import '../../src/experience-v2.css';import '../../src/experience-v2/components/components.css';import '../../src/experience-v2/shell/shell.css';import '../../src/experience-v2/ui-density-refinement.css';
const me={id:'synthetic-compliance',org_id:'synthetic-org',preferred_name:'Catherine',full_name:'Catherine Fixture',role:'manager',is_admin:false,is_exec:false,capabilities:['compliance.manage'],capability_grants:[{capability:'compliance.manage',scope_unit_id:null}]};
createRoot(document.getElementById('root')).render(<div className="app manager-app"><SideNav me={me} isManager tab="compliance" setTab={()=>{}}/><div className="ev2s-workspace"><AppTopBar me={me} isManager tab="compliance"/><main className="app-content ev2s-content"><Compliance me={me}/></main></div></div>);
