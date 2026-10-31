/** Human-readable quarterly reporting sections stored using the existing
 * versioned narrative field. Legacy reports remain untouched. */
export function composeQuarterlyNarrative({outcomes="",nextPriorities="",decisionRequests=""}={}) {
 const sections=[
   ["Achievements and outcomes",outcomes],
   ["Next-quarter priorities",nextPriorities],
   ["Leadership decisions or support requested",decisionRequests],
 ];
 return sections.map(([name,value])=>name+":\n"+(String(value||"").trim()||"Not recorded")).join("\n\n");
}
export function parseQuarterlyNarrative(value="") {
 const raw=String(value||"");
 const pattern=/^Achievements and outcomes:\n([\s\S]*?)\n\nNext-quarter priorities:\n([\s\S]*?)\n\nLeadership decisions or support requested:\n([\s\S]*)$/;
 const match=raw.match(pattern);
 if(!match)return {outcomes:raw,nextPriorities:"",decisionRequests:""};
 const clean=part=>part.trim()==="Not recorded"?"":part.trim();
 return {outcomes:clean(match[1]),nextPriorities:clean(match[2]),decisionRequests:clean(match[3])};
}
