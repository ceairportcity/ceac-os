# CEAC OS — Technical Support Panel Spec v1

Date: 6 October 2026
Status: LOCKED PRODUCT DIRECTION / IMPLEMENTATION PENDING
Owner: CEAC
Related programme: `docs/security/CEAC_SECURITY_HARDENING_PROGRAM_2026-10-06.md`

## 1. Purpose

Technical Support keeps CEAC usable, safe and dependable, and turns recurring technical problems into permanent improvements.

This is not an enterprise IT dashboard and not a hidden super-admin panel.

Value comes before sophistication. The panel exists so a capable CEAC Technical Support lead can understand what is happening, help people, protect access, keep the platform recoverable and know what needs escalation without having to understand software-engineering jargon.

## 2. Organisation position

Technical Support:
- remains organisationally associated with Media & Technical;
- operates as an autonomous service team for its technical-support mandate;
- reports directly to Administration & HR and the Group Pastor;
- is not a separate normal department like Finance or Welfare;
- may include volunteers;
- does not inherit employee/payroll status merely because a person has CEAC access.

Gabriel is the intended Technical Support Lead / Manager after the final transition.

His historical Media & Technical work and attribution remain preserved. His current operating placement is ended/deactivated only when the Technical Support transition is ready; it is never deleted.

## 3. Authority model

Technical Support is broad in technical reach but narrow in business authority.

Technical Support may:
- diagnose platform problems;
- receive and resolve support requests;
- resend/recover invitations and approved access;
- execute approved access changes;
- manage technical incidents;
- inspect service health, logs and technical failure metadata;
- verify backups/recovery readiness;
- manage integrations/configuration within approved technical scope;
- maintain technical runbooks and known fixes;
- see whether protected subsystems are healthy.

Technical Support may not independently:
- view salary amounts;
- approve payroll;
- change compensation;
- view protected medical information;
- read confidential HR documents without explicit need/approval;
- decide leave outcomes;
- decide disciplinary outcomes;
- change compliance findings;
- make itself Admin/HR, Payroll or Executive;
- grant itself broader authority.

High-risk access changes require the correct business approver and immutable audit evidence.

## 4. Navigation

Keep the panel small.

- Home
- Help Desk
- People & Access
- System
- Improvements
- Guides

No separate navigation for database, RLS, RPCs, migrations, logs, backups, security, integrations or deployments unless later usage proves a dedicated destination is necessary. Those details live inside the six operating destinations.

## 5. Home — “What needs me?”

This is the operating inbox, not a dashboard.

Order:

### Needs you
Only items requiring Technical Support action now:
- staff cannot sign in;
- invitation failed;
- system/service failure;
- backup/recovery warning;
- security warning;
- unresolved support request;
- failed integration/change.

Each item shows:
- what happened;
- who/what is affected;
- what to do next;
- approval needed from, if any.

### CEAC right now
Simple service state:
- CEAC platform — Working / Needs attention / Down
- Sign in & accounts — Working / Needs attention / Down
- Files & uploads — Working / Needs attention / Down
- Invitations & email — Working / Needs attention / Down
- Automatic jobs — Working / Needs attention / Down
- Backup & recovery — Working / Needs attention / Down

### Waiting for approval
Technical actions Technical Support cannot execute until the correct approver acts.

### Recently resolved
Short evidence that previous problems were actually closed.

No CPU charts, infrastructure vanity metrics or health-score percentages.

## 6. Help Desk — “Help people work”

Every CEAC user gets a simple **Get technical help** action.

The user chooses plain-language categories:
- I cannot sign in
- Something is not working
- I cannot upload something
- I need access to something
- My information looks wrong
- Something else

They may describe the issue and attach evidence.

Technical Support receives:
- person;
- department;
- problem;
- affected service;
- reported time;
- urgency based on actual impact;
- known system evidence;
- suggested first check;
- current owner/status.

When opened, the support case uses:

**What happened**
Plain summary.

**What CEAC knows**
Relevant factual system evidence.

**Try this first**
Safest likely fix.

**If that does not work**
Next step.

**Approval needed**
Only where applicable.

Technical details stay collapsed by default.

## 7. People & Access — “Who can get in?”

Show:
- active people;
- invited but not activated;
- activation/sign-in problems;
- deactivated/leavers;
- privileged users;
- temporary access and expiry;
- approved access changes waiting to be applied;
- account with no matching active person;
- active person needing an account.

### Joining
Track invitation → activation → first login → correct team/authority.

### Moving
Support additional responsibility, team transfer, manager change and temporary delegation without creating duplicate identities.

### Volunteers
A volunteer may have:
- CEAC account;
- Technical Support membership;
- role/capabilities needed for technical duties;

without automatically receiving:
- payroll;
- employee leave;
- employee benefits;
- employment status.

### Leaving
Guided path:
- end active access;
- remove temporary privileges;
- preserve completed work/history;
- preserve immutable attribution;
- record actor/reason/time.

## 8. System — “Is CEAC working?”

Do not expose raw developer systems as the default view.

Present:
- CEAC Platform
- Sign in & accounts
- Files & uploads
- Invitations & email
- Automatic jobs
- Backup & recovery
- Connected services

Each uses only:
- Working
- Needs attention
- Down

Opening a problem shows:
1. What happened
2. Who/what is affected
3. What to do next
4. Approval needed from
5. Technical details ▾

Technical details may expose logs, provider messages, IDs, RLS/RPC/migration information, deployment refs and diagnostic evidence for advanced troubleshooting.

## 9. Improvements — “What keeps happening?”

This is what turns support into organisational improvement.

The system should surface recurring technical friction such as:
- repeated activation failures;
- recurring upload problems;
- a department repeatedly unable to use one workflow;
- repeated confusion about where/how to perform the same action;
- recurring integration failures.

Language:
- **Keeps happening**
- how many related cases;
- who/what is affected;
- likely common cause if supported by evidence;
- suggested improvement;
- current improvement status.

Technical Support may turn a recurring support pattern into an improvement proposal.

This is not employee performance scoring.

## 10. Guides — “I need to…”

Guides are the handover engine.

Initial guides:
- Help someone who cannot sign in
- Help a new person join CEAC
- Add/remove approved access
- Handle someone leaving
- Check whether CEAC is working
- Respond when something looks unsafe
- Check the latest backup
- Recover after a failed update
- Handle a failed integration
- Change/rotate a technical key safely
- Escalate a suspected security incident

A guide must be written for a competent non-specialist. It should give the next action, not merely explain concepts.

## 11. Security & recovery presentation

Security should be translated into operational language.

Example default:
**Protected system actions need review**
4 issues need attention.
No confirmed unauthorised access detected.
[Review issues]

Not:
“135 SECURITY DEFINER RPC warnings.”

Raw findings belong under Technical details.

Recovery shows:
- latest successful backup;
- failed backup if any;
- last successful restore test;
- whether recovery instructions are current;
- what action is needed.

## 12. Change history — “What changed?”

Technical Support must be able to see significant technical changes that may explain a problem:
- application release;
- database change;
- integration/configuration change;
- access/privilege change;
- failed change;
- rollback.

Each record shows:
- what changed;
- who changed/approved it;
- when;
- whether it succeeded;
- what it affected.

## 13. Department technical view

For each CEAC unit, show only technical-operational context:
- open support issues;
- affected users;
- invitation/account failures;
- CEAC features/integrations currently failing for the unit;
- current incidents;
- resolved technical issue history;
- recurring technical problems.

Do not expose the department's confidential HR/payroll/content merely because Technical Support is troubleshooting it.

## 14. Leadership summary

Generate a short monthly Technology & Support Summary for Administration & HR / Group Pastor:

- major outages or none;
- support requests opened/resolved/outstanding;
- recurring problem needing a permanent fix;
- security issues requiring leadership attention;
- backup/recovery status;
- access changes of note;
- decisions required from leadership.

No infrastructure vanity metrics and no technology “performance score.”

## 15. What not to build now

Do not build unless real CEAC operations prove value:
- enterprise asset-management suite;
- printer/device inventory;
- network monitoring suite;
- elaborate SLA engine;
- CMDB;
- AI support chatbot;
- complex severity taxonomy;
- employee technology score;
- large service catalogue;
- vendor-contract system;
- license/depreciation system.

## 16. Definition of value

Technical Support v1 is successful when:

1. People know exactly where to get technical help.
2. Technical Support knows what needs attention before relying on phone calls.
3. Access stays correct as people join, move, volunteer and leave.
4. CEAC can tell whether the platform is healthy.
5. Security warnings become understandable actions.
6. CEAC can prove it has usable backups and a recovery path.
7. Technical Support can trace what changed before a problem began.
8. Repeated technical problems become permanent improvements.
9. Technical Support can escalate decisions it does not own.
10. CEAC Technical Support can operate the platform after TSI handover without requiring the builder.

Anything beyond this must demonstrate concrete operational value before it enters scope.
