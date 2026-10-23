import './ControlCenterTrail.css';

const PAGES = {
  'office-settings':'Office settings', units:'Departments', authority:'Access permissions',
  policies:'Policies & rules', integrations:'Connected apps', audit:'Audit', events:'System events',
  workflows:'Checks & workflows', lifecycle:'Account lifecycle', 'protected-hr':'Protected HR',
  people:'People & access', attendance:'Attendance', finance:'Finance', payroll:'Payroll',
};

export default function ControlCenterTrail({ tab, go }) {
  if (!PAGES[tab]) return null;
  return <nav aria-label="Settings navigation" className="control-center-trail">
    <a href="?tab=settings" onClick={event=>{
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();go('settings');
    }}>← Control Center</a>
    <span aria-hidden="true">/</span><span aria-current="page">{PAGES[tab]}</span>
  </nav>;
}
