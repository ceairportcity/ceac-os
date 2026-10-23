export const RESPONSIBILITY_STATUS = {
  not_started:'Not started', in_progress:'In progress', waiting_on:'Waiting', waiting:'Waiting',
  blocked:'Blocked', returned:'Returned', in_review:'In review', scheduled:'Scheduled',
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
  const groups=['In progress','Waiting & review','Upcoming','Completed','Archived','Other'];
  const groupFor = status=>['completed','self_certified'].includes(status)?'Completed'
    : status==='cancelled'?'Archived'
    : ['waiting','waiting_on','blocked','returned','in_review'].includes(status)?'Waiting & review'
    : ['not_started','scheduled'].includes(status)?'Upcoming'
    : status==='in_progress'?'In progress':'Other';
  return groups.map(title=>({title,items:rows.filter(row=>groupFor(row.status)===title)}))
    .filter(group=>group.items.length);
}
