import { isWorkOverdue } from "./time";
export const RESPONSIBILITY_STATUS = {
  not_started:'Not started', in_progress:'In progress', waiting_on:'Waiting on someone else', waiting:'Waiting',
  blocked:'Waiting on someone else', returned:'Changes requested', in_review:'Awaiting approval', scheduled:'Scheduled',
  completed:'Completed', self_certified:'Completed', cancelled:'Cancelled',
};

export function filterResponsibilities(rows, {query='', projectId='', status=''} = {}) {
  const search=query.trim().toLocaleLowerCase();
  return rows.filter(row=>(!projectId || row.project_id===projectId)
    && (!status || row.status===status)
    && (!search || [row.title,row.ref,row.projects?.name,row.profiles?.full_name]
      .some(value=>String(value||'').toLocaleLowerCase().includes(search))));
}

export function groupResponsibilities(rows) {
  const groups=["Needs attention","In progress","With reviewer or waiting","Upcoming","Completed","Archived","Other"];
  const groupFor = row=>row.status==="returned" || isWorkOverdue(row)?"Needs attention"
    : ["completed","self_certified"].includes(row.status)?"Completed"
    : row.status==="cancelled"?"Archived"
    : ["waiting","waiting_on","blocked","in_review"].includes(row.status)?"With reviewer or waiting"
    : ["not_started","scheduled"].includes(row.status)?"Upcoming"
    : row.status==="in_progress"?"In progress":"Other";
  return groups.map(title=>({title,items:rows.filter(row=>groupFor(row)===title)}))
    .filter(group=>group.items.length);
}
