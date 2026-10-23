import { Fragment, useEffect, useId, useMemo, useState } from 'react';
import { dueLabel } from '../lib/time';
import { filterResponsibilities, groupResponsibilities, RESPONSIBILITY_STATUS } from '../lib/responsibilityRegister';
import './ResponsibilityRegister.css';

export default function ResponsibilityRegister({rows,selectedId,onSelect,emptyAction,onAdd}) {
  const id=useId();
  const [query,setQuery]=useState('');
  const [projectId,setProjectId]=useState('');
  const [status,setStatus]=useState('');
  const [collapsed,setCollapsed]=useState({});
  const [page,setPage]=useState(0);
  const pageSize=10;
  const projects=useMemo(()=>{
    const seen=new Map();
    rows.forEach(row=>{if(row.project_id) seen.set(row.project_id,row.projects?.name||'Linked project');});
    return [...seen].sort((a,b)=>a[1].localeCompare(b[1]));
  },[rows]);
  const statuses=useMemo(()=>[...new Set(rows.map(row=>row.status))].sort(),[rows]);
  const visible=useMemo(()=>filterResponsibilities(rows,{query,projectId,status}),[rows,query,projectId,status]);
  const allGroups=useMemo(()=>groupResponsibilities(visible),[visible]);
  const ordered=useMemo(()=>allGroups.flatMap(group=>group.items),[allGroups]);
  const pageCount=Math.max(1,Math.ceil(ordered.length/pageSize));
  const currentPage=Math.min(page,pageCount-1);
  const start=currentPage*pageSize;
  const pageIds=new Set(ordered.slice(start,start+pageSize).map(row=>row.id));
  const groups=allGroups.map(group=>({...group,total:group.items.length,items:group.items.filter(row=>pageIds.has(row.id))})).filter(group=>group.items.length);
  useEffect(()=>{
    const index=ordered.findIndex(row=>row.id===selectedId);
    if(index>=0)setPage(Math.floor(index/pageSize));
  },[selectedId,ordered]);
  function changePage(next) {
    const target=Math.max(0,Math.min(next,pageCount-1));
    setPage(target);
    const first=ordered[target*pageSize];
    if(first) {
      const group=allGroups.find(item=>item.items.some(row=>row.id===first.id));
      if(group)setCollapsed(current=>({...current,[group.title]:false}));
      onSelect(first.id);
    }
  }
  function filter(next) {
    const values={query,projectId,status,...next};
    setPage(0);
    setQuery(values.query);setProjectId(values.projectId);setStatus(values.status);
    setCollapsed({});
    onSelect(groupResponsibilities(filterResponsibilities(rows,values))[0]?.items[0]?.id||'none');
  }
  return <>
    <div className="s2-register-filters" role="search" aria-label="Find responsibilities">
      <label className="s2-register-search"><span className="sr-only">Find a responsibility</span>
        <input type="search" value={query} onChange={event=>filter({query:event.target.value})} placeholder="Find a task, project or reference…" />
      </label>
      <label><span className="sr-only">Filter by project</span><select value={projectId} onChange={event=>filter({projectId:event.target.value})}>
        <option value="">All projects</option>{projects.map(([value,label])=><option key={value} value={value}>{label}</option>)}
      </select></label>
      <label><span className="sr-only">Filter by status</span><select value={status} onChange={event=>filter({status:event.target.value})}>
        <option value="">Any status</option>{statuses.map(value=><option key={value} value={value}>{RESPONSIBILITY_STATUS[value]||value.replaceAll('_',' ')}</option>)}
      </select></label>
    </div>
    <div className="s2-register-table-region" role="region" aria-label="Responsibility register" tabIndex={0}>
      <table className="s2-register-table">
        <caption className="sr-only">Responsibilities, projects, due dates and recorded work status</caption>
        <thead><tr><th scope="col">Responsibility</th><th scope="col" className="s2-register-project">Project</th><th scope="col" className="s2-register-due">Due</th><th scope="col">Status</th></tr></thead>
        {groups.map(group=><Fragment key={group.title}><tbody>
          <tr className="s2-register-group"><th colSpan={4} scope="rowgroup">
            <button type="button" aria-expanded={!collapsed[group.title]} aria-controls={`${id}-${group.title.replaceAll(' ','-')}`}
              onClick={()=>setCollapsed(current=>({...current,[group.title]:!current[group.title]}))}>
              <span aria-hidden="true">{collapsed[group.title]?'›':'⌄'}</span>{group.title}<span>{group.items.length===group.total?group.total:`${group.items.length} of ${group.total}`}</span>
            </button>
          </th></tr>
        </tbody><tbody id={`${id}-${group.title.replaceAll(' ','-')}`} hidden={Boolean(collapsed[group.title])}>
          {group.items.map(row=><tr key={row.id} className={`s2-register-row${selectedId===row.id?' is-selected':''}`}>
            <th scope="row"><button type="button" aria-pressed={selectedId===row.id} onClick={()=>onSelect(row.id)}>
              <strong>{row.title}</strong><small>{row.ref} · {row.visibility==='private'?'Private':row.origin==='self_created'?'Created by me':'Assigned work'}</small>
            </button></th>
            <td className="s2-register-project">{row.projects?.name||'Not linked'}</td>
            <td className="s2-register-due">{dueLabel(row.due_at)}</td>
            <td><span className="s2-register-status" data-state={row.status}>{RESPONSIBILITY_STATUS[row.status]||row.status?.replaceAll('_',' ')||'Not recorded'}</span></td>
          </tr>)}
        </tbody></Fragment>)}
        {groups.length===0&&<tbody><tr><td colSpan={4} className="s2-register-empty">
          {rows.length?'No responsibilities match these filters.':'No responsibilities recorded in this view.'}
          {(query||projectId||status)&&<button type="button" onClick={()=>filter({query:'',projectId:'',status:''})}>Clear filters</button>}
          {!rows.length&&emptyAction&&<button type="button" onClick={emptyAction.onClick}>{emptyAction.label}</button>}
        </td></tr></tbody>}
      </table>
    </div>
    <footer className="s2-register-footer" style={{flexWrap:"wrap"}}><span aria-live="polite">{pageCount>1?`${start+1}–${Math.min(start+pageSize,visible.length)} of ${visible.length} responsibilities`:`${visible.length} displayed`}</span>
      {pageCount>1&&<nav aria-label="Responsibility pages" style={{display:"flex",alignItems:"center",gap:12}}>
        <button type="button" aria-label="Previous responsibility page" disabled={currentPage===0} onClick={()=>changePage(currentPage-1)}>Previous</button>
        <span>Page {currentPage+1} of {pageCount}</span>
        <button type="button" aria-label="Next responsibility page" disabled={currentPage===pageCount-1} onClick={()=>changePage(currentPage+1)}>Next</button>
      </nav>}
      {onAdd&&<button type="button" onClick={onAdd}>Add another responsibility →</button>}
    </footer>
  </>;
}
