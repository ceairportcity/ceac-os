import "./manager-overview.css";
import {
  Button,
  DataPanel,
  QueueRow,
  Skeleton,
  StatePanel,
  StatTile,
  StatusBadge,
  Surface,
} from "../components";
import { CeacIcon } from "../icons";
import { dueLabel, isOverdue } from "../../lib/time";

function money(minor, currency) {
  return `${currency} ${(Number(minor || 0) / 100).toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value, options = {}) {
  if (!value) return "";
  return new Date(value).toLocaleString("en-GB", {
    timeZone: "Africa/Accra",
    day: "numeric",
    month: "short",
    ...options,
  });
}

function workTone(item) {
  if (!item) return "neutral";
  if (item.status === "returned" || isOverdue(item.due_at)) return "danger";
  if (item.status === "waiting_on") return "warning";
  if (["completed", "self_certified"].includes(item.status)) return "success";
  return "action";
}

function Count({ value, tone = "neutral" }) {
  return <span className={`managerv2-count is-${tone}`}>{value}</span>;
}

function Quiet({ icon = "checkCircle", children }) {
  return <div className="managerv2-quiet">
    <CeacIcon name={icon} size="row" decorative />
    <span>{children}</span>
  </div>;
}

function PulseFact({ label, value, meta, tone = "neutral", onClick }) {
  return <button
    type="button"
    className={`managerv2-pulse-fact is-${tone}`}
    onClick={onClick}
  >
    <strong>{value}</strong>
    <span>{label}</span>
    {meta ? <small>{meta}</small> : null}
  </button>;
}

function DecisionRow({ icon, title, meta, note, status, statusTone = "warning", actions }) {
  return <div className="managerv2-decision-row">
    <span className="managerv2-row-icon"><CeacIcon name={icon} size="row" decorative /></span>
    <span className="managerv2-decision-copy">
      <span className="managerv2-decision-title">{title}</span>
      {meta ? <span className="managerv2-decision-meta">{meta}</span> : null}
      {note ? <span className="managerv2-decision-note">{note}</span> : null}
    </span>
    {status ? <StatusBadge tone={statusTone}>{status}</StatusBadge> : null}
    {actions ? <div className="managerv2-decision-actions">{actions}</div> : null}
  </div>;
}

function ProjectRow({ project, onOpen, onDrill }) {
  const facts = [];
  if (project.atRisk?.length) facts.push(`${project.atRisk.length} objective${project.atRisk.length === 1 ? "" : "s"} need attention`);
  if (project.objectivesWithoutActiveWork?.length) facts.push(`${project.objectivesWithoutActiveWork.length} active objective${project.objectivesWithoutActiveWork.length === 1 ? "" : "s"} with no active work`);
  if (project.openDeliverables?.length) facts.push(`${project.openDeliverables.length} open deliverable${project.openDeliverables.length === 1 ? "" : "s"}`);
  if (project.closesThisWeek) facts.push("Ends this week");

  return <div className="managerv2-project-row">
    <button type="button" className="managerv2-project-main" onClick={() => onOpen?.(project.id)}>
      <span className="managerv2-row-icon"><CeacIcon name="projects" size="row" decorative /></span>
      <span>
        <strong>{project.name}</strong>
        <small>{facts.length ? facts.join(" · ") : "Open project context"}</small>
      </span>
      <CeacIcon name="chevronRight" size="meta" decorative />
    </button>
    {project.taskCount > 0 ? <button
      type="button"
      className="managerv2-progress-link"
      onClick={() => onDrill?.({ zone: "project", title: `${project.name} tasks`, rows: project.tasks })}
    >
      <span>{project.completedTasks} of {project.taskCount} tasks completed</span>
      <span className="managerv2-progress" aria-hidden="true"><span style={{ width: `${Math.round((project.completedTasks / project.taskCount) * 100)}%` }} /></span>
    </button> : null}
  </div>;
}

function FinancePosition({ row, onOpen }) {
  const hasBudget = Number(row.budget_minor || 0) > 0;
  return <div className="managerv2-finance-row">
    <div className="managerv2-finance-head">
      <div><span>Currency</span><strong>{row.currency}</strong></div>
      <StatusBadge tone={hasBudget ? "action" : "neutral"}>{hasBudget ? "Budget recorded" : "No budget recorded"}</StatusBadge>
    </div>
    <div className="managerv2-finance-facts">
      <span><strong>{hasBudget ? money(row.budget_minor, row.currency) : "—"}</strong><small>Planned</small></span>
      <span><strong>{money(row.spent_minor, row.currency)}</strong><small>Spent</small></span>
      <span><strong>{money(row.committed_minor, row.currency)}</strong><small>Committed</small></span>
      <span><strong>{hasBudget ? money(row.remaining_minor, row.currency) : "—"}</strong><small>Remaining</small></span>
    </div>
    <Button variant="quiet" size="compact" onClick={onOpen}>Open Finance</Button>
  </div>;
}

function homeDayKey(value) {
  if (!value) return "";
  const d = new Date(value);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function homeMonthGrid(now = new Date()) {
  const year = now.getFullYear();
  const month = now.getMonth();
  const first = new Date(year, month, 1);
  const gridStart = new Date(year, month, 1 - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return { date, inMonth: date.getMonth() === month, key: homeDayKey(date) };
  });
}

function HomeReferenceRow({ icon = "work", title, meta, tone = "neutral", onClick }) {
  const content = <>
    <span className={`fpg9-home-row-icon is-${tone}`}><CeacIcon name={icon} size="row" decorative /></span>
    <span className="fpg9-home-row-copy"><strong>{title}</strong>{meta ? <small>{meta}</small> : null}</span>
    {onClick ? <CeacIcon name="chevronRight" size="meta" decorative /> : null}
  </>;
  return onClick
    ? <button type="button" className="fpg9-home-row" onClick={onClick}>{content}</button>
    : <div className="fpg9-home-row">{content}</div>;
}

function decisionPreview(decision) {
  if (!decision) return { title: "Attention item", meta: "" };
  if (decision.type === "submission") {
    return {
      title: decision.item?.work_items?.title || "Submission awaiting review",
      meta: `${decision.item?.profiles?.full_name || "Team member"} · Review required · ${formatDate(decision.item?.submitted_at, { hour: "2-digit", minute: "2-digit" })}`,
      icon: "work",
    };
  }
  if (decision.type === "leave") {
    return {
      title: `${decision.item?.profiles?.full_name || "Team member"} · leave request`,
      meta: `${decision.item?.start_date || ""} → ${decision.item?.end_date || ""}`,
      icon: "time",
    };
  }
  if (decision.type === "blocker") {
    return {
      title: decision.item?.work_items?.title || "Dependency needs a reply",
      meta: decision.item?.note || decision.item?.party_text || "Reply required",
      icon: "warning",
    };
  }
  return {
    title: decision.item?.message || "Follow-up needs attention",
    meta: decision.item?.last_seen_at ? `Follow-up · ${formatDate(decision.item.last_seen_at)}` : "Follow-up",
    icon: "notification",
  };
}

export default function ManagerOverviewV2({
  me,
  greeting,
  dateLabel,
  loading,
  loadFailed,
  error,
  busy,
  decisionRows = [],
  reviewFollowupByWork,
  blockers = [],
  team,
  projects = [],
  incomingRequests = [],
  financePositions = [],
  serviceDayData = [],
  mine = [],
  delegated = [],
  week,
  upcomingMeetings = [],
  upcomingProjects = [],
  routines = [],
  recentMovement = [],
  drill,
  drillRows = [],
  onRetry,
  onGiveOutWork,
  onOpenWork,
  onOpenItem,
  onOpenProject,
  onOpenMeeting,
  onScheduleMeeting,
  onOpenPerson,
  onOpenReview,
  onBlockerDisagree,
  onBlockerAcknowledge,
  onResolveBlocker,
  onOpenFinance,
  onNavigate,
  onDrill,
}) {
  const actionableBlockers = blockers
    .filter((blocker) => blocker.direction === "incoming" && blocker.state === "claimed")
    .map((item) => ({ type: "blocker", since: item.since, item }));
  const acknowledgedIncoming = blockers
    .filter((blocker) => blocker.direction === "incoming" && blocker.state === "acknowledged");
  const decisions = [...decisionRows, ...actionableBlockers]
    .sort((left, right) => new Date(left.since || 0) - new Date(right.since || 0));
  const decisionCount = decisions.length;
  const deliveryBlockers = blockers.filter((blocker) => !(blocker.direction === "incoming" && blocker.state === "claimed"));
  const serviceDayHasData = serviceDayData.some((row) => Number(row.sunday) > 0 || Number(row.midweek) > 0);
  const now = new Date();
  const todayKey = homeDayKey(now);
  const monthCells = homeMonthGrid(now);
  const markedDates = new Set([
    ...upcomingMeetings.map((meeting) => homeDayKey(meeting.starts_at)),
    ...upcomingProjects.map((project) => homeDayKey(project.ends_on)),
  ].filter(Boolean));
  const nextWork = mine[0] || delegated[0] || null;
  const waitingRows = [
    ...acknowledgedIncoming,
    ...deliveryBlockers.filter((blocker) => blocker.direction === "outgoing"),
  ].slice(0, 3);
  const attentionRows = decisions.slice(0, 3);
  const comingRows = [
    ...upcomingMeetings.map((meeting) => ({
      key: `meeting-${meeting.id}`,
      icon: "meeting",
      title: meeting.title,
      meta: formatDate(meeting.starts_at, { weekday: "short", hour: "2-digit", minute: "2-digit" }),
      onClick: () => onOpenMeeting?.(meeting.id),
    })),
    ...upcomingProjects.map((project) => ({
      key: `project-${project.id}`,
      icon: "projects",
      title: project.name,
      meta: project.ends_on ? `Ends ${formatDate(project.ends_on)}` : "Active project",
      onClick: () => onOpenProject?.(project.id),
    })),
  ].slice(0, 4);
  const activeMine = mine.filter((item) => !["returned", "waiting_on"].includes(item.status)).length;
  const awaitingReview = decisionRows.filter((row) => row.type === "submission").length;
  const previewWork = [...mine, ...delegated]
    .filter((item, index, rows) => rows.findIndex((candidate) => candidate.id === item.id) === index)
    .slice(0, 3);
  const previewPeople = [...team.working, ...team.present, ...team.leave, ...team.notStarted]
    .filter((person, index, rows) => rows.findIndex((candidate) => candidate.id === person.id) === index)
    .slice(0, 4);
  const previewProjects = (projects.length ? projects : upcomingProjects).slice(0, 3);

  return <div className="body manager-home">
    <div className="managerv2">
      <header className="fpg9-home-hero">
        <div className="fpg9-home-hero-copy">
          <div className="fpg9-home-context"><span>{me.unit_name}</span><time>{dateLabel}</time></div>
          <h1>{greeting}, {me.full_name.split(" ")[0]} <span aria-hidden="true">👋</span></h1>
          <p>“Small faithfulness compounds into extraordinary impact.”</p>
          <div className="fpg9-home-hero-action"><Button onClick={onGiveOutWork}>Give out work</Button></div>
        </div>
        <div className="fpg9-home-impact" aria-label="Recorded work context">
          <span>You’re making a difference</span>
          <div>
            <strong>{team.completed.length}<small>Work completed</small></strong>
            <strong>{activeMine}<small>In progress</small></strong>
            <strong>{awaitingReview}<small>Awaiting review</small></strong>
          </div>
        </div>
      </header>

      {loadFailed ? <StatePanel
        state="error"
        title="Manager Overview could not finish loading"
        description={error || "Some manager context could not be loaded."}
        actionLabel="Try again"
        onAction={onRetry}
      /> : null}

      {!loadFailed && error ? <Surface variant="soft" padding="standard" className="managerv2-notice" role="alert">
        <CeacIcon name="error" size="row" decorative />
        <div><strong>Could not complete that</strong><span>{error}</span></div>
      </Surface> : null}

      {loading ? <div className="managerv2-loading" role="status" aria-live="polite" aria-busy="true" aria-label="Loading Manager Overview">
        <Surface variant="plain" padding="standard"><Skeleton width="32%" /><Skeleton width="88%" /><Skeleton width="72%" /></Surface>
        <Surface variant="plain" padding="standard"><Skeleton width="28%" /><Skeleton width="100%" /><Skeleton width="82%" /></Surface>
        <Surface variant="plain" padding="standard"><Skeleton width="36%" /><Skeleton width="94%" /><Skeleton width="76%" /></Surface>
      </div> : null}

      {!loading && !loadFailed ? <main className="managerv2-main">
        <nav className="fpg9-mobile-shortcuts" aria-label="Home shortcuts">
          <button type="button" className="is-active" aria-current="page">Today</button>
          <button type="button" onClick={() => onNavigate?.("work")}>Work</button>
          <button type="button" onClick={() => onNavigate?.("team")}>Team</button>
        </nav>
        <section className="fpg9-home-reference" aria-label="Manager home">
          <div className="fpg9-home-focus">
            <article className="fpg9-next-card">
              <div className="fpg9-next-visual" aria-hidden="true"><CeacIcon name="work" size="nav" decorative /></div>
              <div className="fpg9-next-copy">
                <span>Next up</span>
                {nextWork ? <>
                  <h2>{nextWork.title}</h2>
                  <p>{nextWork.ref}{nextWork.due_at ? ` · ${dueLabel(nextWork.due_at)}` : ""}</p>
                  <div className="fpg9-next-status"><StatusBadge tone={workTone(nextWork)}>{nextWork.status?.replaceAll("_", " ") || "Open"}</StatusBadge></div>
                  <Button size="compact" onClick={() => onOpenItem?.(nextWork.id)}>Continue work</Button>
                </> : <>
                  <h2>No urgent work is queued</h2>
                  <p>Your recorded manager work has no immediate item to continue.</p>
                  <Button size="compact" onClick={onOpenWork}>Open Work</Button>
                </>}
              </div>
            </article>

            <article className="fpg9-schedule-card">
              <header><h2>Today’s schedule</h2><button type="button" onClick={() => onNavigate?.("calendar")}>View all</button></header>
              <div>
                {upcomingMeetings.filter((meeting) => homeDayKey(meeting.starts_at) === todayKey).slice(0, 4).map((meeting) => <HomeReferenceRow
                  key={meeting.id}
                  icon="meeting"
                  title={meeting.title}
                  meta={formatDate(meeting.starts_at, { hour: "2-digit", minute: "2-digit" })}
                  tone="action"
                  onClick={() => onOpenMeeting?.(meeting.id)}
                />)}
                {!upcomingMeetings.some((meeting) => homeDayKey(meeting.starts_at) === todayKey)
                  ? <p className="fpg9-home-empty">No meeting is recorded for today.</p> : null}
              </div>
            </article>
          </div>

          <aside className="fpg9-calendar-card">
            <header>
              <div><strong>{now.toLocaleString("en-GB", { month: "long", year: "numeric" })}</strong><span>Recorded dates</span></div>
              <button type="button" onClick={() => onNavigate?.("calendar")}>Calendar</button>
            </header>
            <div className="fpg9-calendar-week"><span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span></div>
            <div className="fpg9-calendar-grid">
              {monthCells.map((cell) => <span key={cell.key} className={[
                !cell.inMonth ? "is-out" : "",
                cell.key === todayKey ? "is-today" : "",
                markedDates.has(cell.key) ? "has-record" : "",
              ].filter(Boolean).join(" ")}>{cell.date.getDate()}</span>)}
            </div>
            <div className="fpg9-later">
              <header><strong>Later this week</strong></header>
              {comingRows.length ? comingRows.slice(0, 3).map((row) => <HomeReferenceRow key={row.key} {...row} />)
                : <p className="fpg9-home-empty">No upcoming meeting or project deadline is recorded.</p>}
            </div>
          </aside>

          <div className="fpg9-home-queues">
            <article className="fpg9-queue-card fpg9-attention-card">
              <header><h2>Needs your attention</h2><Count value={decisionCount} tone={attentionRows.length ? "attention" : "success"} /></header>
              {awaitingReview > 0 && <Button variant="secondary" size="compact" onClick={() => onNavigate?.("work")}>Needs review · {awaitingReview}</Button>}
              {attentionRows.length ? attentionRows.map((decision, index) => {
                const row = decisionPreview(decision);
                if (decision.type === "blocker") {
                  return <DecisionRow
                    key={decision.item?.id || index}
                    icon={row.icon}
                    title={row.title}
                    meta={row.meta}
                    status="Needs response"
                    statusTone="warning"
                    actions={<>
                      <Button variant="secondary" size="compact" busy={busy} onClick={() => onBlockerAcknowledge?.(decision.item)}>Acknowledge</Button>
                      <Button variant="quiet" size="compact" busy={busy} onClick={() => onBlockerDisagree?.(decision.item)}>Disagree</Button>
                    </>}
                  />;
                }
                const itemId = decision.type === "submission" ? decision.item?.work_items?.id : null;
                const onClick = decision.type === "leave"
                  ? () => onNavigate?.("attendance")
                  : itemId ? () => onOpenItem?.(itemId) : undefined;
                return <HomeReferenceRow key={decision.item?.id || index} icon={row.icon} title={row.title} meta={row.meta} tone="danger" onClick={onClick} />;
              }) : <p className="fpg9-home-empty">Nothing needs your authority right now.</p>}
            </article>

            <article className="fpg9-queue-card fpg9-waiting-card">
              <header><h2>Waiting on others</h2><Count value={waitingRows.length} /></header>
              {waitingRows.length ? waitingRows.map((blocker) => blocker.direction === "incoming" && blocker.state === "acknowledged"
                ? <div className="managerv2-dependency-row" key={blocker.id}>
                    <HomeReferenceRow
                      icon="pending"
                      title={blocker.work_items?.title || "Dependency"}
                      meta={`Acknowledged · ${blocker.units?.name || blocker.party_text || "your unit"}`}
                      tone="action"
                      onClick={() => onOpenItem?.(blocker.work_item_id)}
                    />
                    <div className="managerv2-dependency-actions">
                      <Button variant="quiet" size="compact" busy={busy} onClick={() => onResolveBlocker?.(blocker)}>Mark resolved</Button>
                    </div>
                  </div>
                : <HomeReferenceRow
                    key={blocker.id}
                    icon="pending"
                    title={blocker.work_items?.title || "Dependency"}
                    meta={`Waiting on ${blocker.units?.name || blocker.party_text || "another unit"}`}
                    tone="action"
                    onClick={() => onOpenItem?.(blocker.work_item_id)}
                  />) : <p className="fpg9-home-empty">No recorded dependency is waiting on another unit.</p>}
            </article>

            <article className="fpg9-queue-card fpg9-coming-card">
              <header><h2>Coming up</h2><Count value={comingRows.length} /></header>
              {comingRows.length ? comingRows.slice(0, 3).map((row) => <HomeReferenceRow key={row.key} {...row} tone="success" />)
                : <p className="fpg9-home-empty">No upcoming meeting or project deadline is recorded.</p>}
            </article>
          </div>

          <section className="fpg9-module-strip" aria-label="Explore CEAC OS">
            <header><h2>Explore CEAC OS</h2><p>Everything you need in one place.</p></header>
            <div>
              {[
                ["work","Work","Get things done.","work"],
                ["team","Team","Your people, together.","people"],
                ["projects","Projects","Turn plans into delivery.","projects"],
                ["calendar","Calendar","See recorded time.","calendar"],
                ["manager-finance","Finance","Manage recorded resources.","finance"],
                ["manager-reports","Reports","See recorded movement.","reports"],
              ].map(([key,label,copy,icon]) => <button key={key} type="button" onClick={() => onNavigate?.(key)}>
                <span><CeacIcon name={icon} size="row" decorative /></span>
                <span><strong>{label}</strong><small>{copy}</small></span>
                <CeacIcon name="chevronRight" size="meta" decorative />
              </button>)}
            </div>
          </section>
        </section>

        <section className="fpg9-workspace-previews" aria-label="Workspace previews">
          <article className="fpg9-preview-card">
            <header><span><CeacIcon name="work" size="row" decorative /><strong>Work</strong></span><button type="button" onClick={() => onNavigate?.("work")}>Open</button></header>
            <p>All your recorded work, in one place.</p>
            <div>{previewWork.length ? previewWork.map((item) => <HomeReferenceRow key={item.id} icon="work" title={item.title} meta={`${item.ref || "Work"} · ${item.status?.replaceAll("_", " ") || "Open"}`} onClick={() => onOpenItem?.(item.id)} />) : <p className="fpg9-home-empty">No immediate work is recorded.</p>}</div>
          </article>

          <article className="fpg9-preview-card">
            <header><span><CeacIcon name="team" size="row" decorative /><strong>Team</strong></span><button type="button" onClick={() => onNavigate?.("team")}>Open</button></header>
            <p>People and today's recorded context.</p>
            <div>{previewPeople.length ? previewPeople.map((person) => {
              const meta = team.working.some((row) => row.id === person.id) ? "Working now"
                : team.leave.some((row) => row.id === person.id) ? "Approved leave"
                  : team.present.some((row) => row.id === person.id) ? "Present today"
                    : "No session recorded yet";
              return <HomeReferenceRow key={person.id} icon="person" title={person.name} meta={meta} onClick={() => onOpenPerson?.(person.id, "current")} />;
            }) : <p className="fpg9-home-empty">No team context is recorded.</p>}</div>
          </article>

          <article className="fpg9-preview-card">
            <header><span><CeacIcon name="projects" size="row" decorative /><strong>Projects</strong></span><button type="button" onClick={() => onNavigate?.("projects")}>Open</button></header>
            <p>Active delivery and recorded deadlines.</p>
            <div>{previewProjects.length ? previewProjects.map((project) => <HomeReferenceRow
              key={project.id}
              icon="projects"
              title={project.name}
              meta={project.ends_on ? `Ends ${formatDate(project.ends_on)}` : project.atRisk?.length ? `${project.atRisk.length} objective${project.atRisk.length === 1 ? "" : "s"} need attention` : "Active project"}
              onClick={() => onOpenProject?.(project.id)}
            />) : <p className="fpg9-home-empty">No active project preview is recorded.</p>}</div>
          </article>

          <article className="fpg9-preview-card">
            <header><span><CeacIcon name="finance" size="row" decorative /><strong>Finance</strong></span><button type="button" onClick={onOpenFinance}>Open</button></header>
            <p>Recorded unit planning by currency.</p>
            <div>{financePositions.length ? financePositions.slice(0, 2).map((row) => <HomeReferenceRow
              key={row.currency}
              icon="finance"
              title={row.currency}
              meta={Number(row.budget_minor || 0) > 0 ? `${money(row.spent_minor, row.currency)} spent · ${money(row.remaining_minor, row.currency)} remaining` : "Budget not recorded"}
              onClick={onOpenFinance}
            />) : <p className="fpg9-home-empty">No unit budget position is recorded.</p>}</div>
          </article>

          <article className="fpg9-preview-card">
            <header><span><CeacIcon name="reports" size="row" decorative /><strong>Reports</strong></span><button type="button" onClick={() => onNavigate?.("manager-reports")}>Open</button></header>
            <p>Recorded movement, without invented scores.</p>
            <div>{serviceDayHasData ? serviceDayData.slice(0, 3).map((row) => <HomeReferenceRow
              key={row.label}
              icon="reports"
              title={row.label}
              meta={`Sunday ${row.sunday} · Midweek ${row.midweek}`}
              onClick={() => onNavigate?.("manager-reports")}
            />) : <p className="fpg9-home-empty">No Sunday or midweek movement is recorded.</p>}</div>
          </article>
        </section>

      </main> : null}
    </div>
  </div>;
}
