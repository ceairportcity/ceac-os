import React from 'react';
import {createRoot} from 'react-dom/client';
import ExecutiveOverviewV2 from '../../src/experience-v2/executive-overview/ExecutiveOverviewV2';
import '../../src/styles.css';
import '../../src/premium.css';
import '../../src/experience-v2.css';
import '../../src/experience-v2/components/components.css';
const me={id:'exec',org_id:'org',full_name:'Synthetic Pastor',is_exec:true};
createRoot(document.getElementById('root')).render(<div className="executive-app"><ExecutiveOverviewV2 me={me} executiveName={me.full_name} executiveDate="Friday 30 October" loading={false} summary={{activeUnits:1,activeTeams:0,activeStaff:2,activeVolunteers:0}} objectiveMix={{}} onOpenOrganisation={()=>{}}/></div>);
