function workIdFromTarget(url){
  const match=typeof url==="string"?url.match(/[?&]item=([^&#]+)/):null;
  if(!match)return null;
  try{return decodeURIComponent(match[1]);}catch{return match[1];}
}
// Only the duplicate preview is hidden; the action and global unread feed are untouched.
export function filterDayNotices(notices=[],actions=[]){
  const workIds=new Set(actions.map(row=>row.workItemId).filter(Boolean));
  const seen = new Set();
  return notices.filter(row=>{
    const workId = workIdFromTarget(row.url);
    if (workId && workIds.has(workId)) return false;
    // One preview per work item. Keep distinct events in the full Updates view.
    const key = workId ? "work:" + workId : row.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
