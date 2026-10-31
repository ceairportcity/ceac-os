import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {composeQuarterlyNarrative,parseQuarterlyNarrative} from "../src/lib/reportNarrativeSections.js";

test("quarterly narrative stores readable sections and restores inputs",()=>{
 const example={outcomes:"Completed three training sessions.",nextPriorities:"Coach team leaders.",decisionRequests:"Approve one venue."};
 const saved=composeQuarterlyNarrative(example);
 for(const heading of ["Achievements and outcomes:", "Next-quarter priorities:", "Leadership decisions or support requested:"])
   assert.ok(saved.includes(heading));
 assert.deepEqual(parseQuarterlyNarrative(saved),example);
});
test("legacy narratives do not lose their source text",()=>{
 const text="Legacy narrative\nParagraph two";
 assert.deepEqual(parseQuarterlyNarrative(text),{outcomes:text,nextPriorities:"",decisionRequests:""});
 assert.deepEqual(parseQuarterlyNarrative(""),{outcomes:"",nextPriorities:"",decisionRequests:""});
});
test("quarterly reports retain existing versioned submission RPCs and evidence",()=>{
 const source=readFileSync("src/screens/ManagerReports.jsx","utf8");
 for(const word of ["p_narrative: submitNarrative()","save_report_draft","save_and_submit_report",
                   "mode === \"quarter\" && !narrative.trim()","Priorities for the next quarter",
                   "Leadership decisions or support requested"])
   assert.ok(source.includes(word),word);
});
