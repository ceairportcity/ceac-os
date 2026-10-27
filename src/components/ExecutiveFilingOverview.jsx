import { useState } from "react";

// A filing distribution, never a performance score. Rows come from the fully
// verified active-unit register so superseded/orphan reports cannot inflate it.
export default function ExecutiveFilingOverview({ rows, period, onFilter }) {
  const [view, setView] = useState("chart");
  const groups = [
    { key: "submitted", label: "Submitted", tone: "filed" },
    { key: "draft", label: "Draft in progress", tone: "draft" },
    { key: "waiting", label: "Not started", tone: "pending" },
  ].map(group => ({ ...group, count: rows.filter(row => row.state === group.key).length }));
  const total = rows.length;
  const submitted = groups[0].count;
  const percent = total ? Math.round(submitted / total * 100) : null;
  return <section className="filing-overview" aria-labelledby="filing-title">
    <header><div><span className="filing-kicker">Reporting coverage</span><h2 id="filing-title">{period.label}</h2></div>
      <span className="filing-period-state">{period.status === "open" ? "Open" : "Closed"}</span>
    </header>
    <div className="filing-composition">
      <div className="filing-primary">
        <div className="filing-ring">
          <svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="51"/><circle className="filing-ring-value" cx="60" cy="60" r="51" pathLength="100" strokeDasharray={`${percent || 0} 100`} /></svg>
          <div><strong>{percent === null ? "—" : percent}<span>{percent === null ? "" : "%"}</span></strong><span>submitted</span></div>
        </div>
        <div className="filing-total"><strong>{submitted}<span> / {total}</span></strong><span>departments have filed</span><small>{period.starts_on} — {period.ends_on}</small></div>
      </div>
      <div className="filing-distribution">
        <div className="filing-view-head"><h3>Filing breakdown</h3><div role="group" aria-label="Filing display">
          {[['chart','Chart'],['table','Table']].map(([key,label])=><button key={key} type="button" aria-pressed={view===key} onClick={()=>setView(key)}>{label}</button>)}
        </div></div>
        {!total ? <p>No active departments are recorded.</p> : view === "chart" ? <div className="filing-bars">
          {groups.map(group=><button key={group.key} type="button" className={`filing-bar is-${group.tone}`} onClick={()=>onFilter(group.key)} aria-label={`Show ${group.label.toLowerCase()}: ${group.count} of ${total} departments`}>
            <span>{group.label}</span><strong>{group.count}<small> / {total}</small></strong>
            <span className="filing-track" aria-hidden="true"><span style={{width:`${group.count / total * 100}%`}}/></span>
          </button>)}
        </div> : <div className="filing-table" tabIndex="0" role="region" aria-label="Filing breakdown table"><table><caption>Active department filing status</caption><thead><tr><th scope="col">Status</th><th scope="col">Departments</th><th scope="col">Share</th></tr></thead><tbody>{groups.map(group=><tr key={group.key}><th scope="row"><button type="button" onClick={()=>onFilter(group.key)}>{group.label}</button></th><td>{group.count}</td><td>{Math.round(group.count / total * 100)}%</td></tr>)}</tbody></table></div>}
      </div>
    </div>
    <footer><span>Filing status only · not a performance score</span><button type="button" onClick={()=>onFilter("waiting")}>View not started <span aria-hidden="true">↗</span></button></footer>
  </section>;
}
