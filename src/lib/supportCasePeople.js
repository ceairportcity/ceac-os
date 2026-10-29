// Names only for authorised cases. The server verifies active Support authority
// without broadening the ordinary profile directory or protected HR access.
export async function supportCasePeople(client, cases) {
  if(!cases.length)return [];
  const result=await client.rpc("support_case_people",{p_case_ids:[...new Set(cases.map(item=>item.id))]});
  if(result.error)throw result.error;
  const names=new Map((result.data || []).map(item=>[item.case_id,item]));
  return cases.map(item=>({...item,...(names.get(item.id) || {})}));
}
