function workIdFromTarget(url){
  const match=typeof url==="string"?url.match(/[?&]item=([^&#]+)/):null;
  if(!match)return null;
  try{return decodeURIComponent(match[1]);}catch{return match[1];}
}
// Only the duplicate preview is hidden; the action and global unread feed are untouched.
export function filterDayNotices(notices=[],actions=[]){
  const workIds=new Set(actions.map(row=>row.workItemId).filter(Boolean));
  return notices.filter(row=>!workIds.has(workIdFromTarget(row.url)));
}
