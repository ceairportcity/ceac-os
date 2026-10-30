import DailyScenicPhoto from "../../components/DailyScenicPhoto";
import {
  ActionFocusCard,
  Button,
  DataPanel,
  QueueRow,
  Skeleton,
  StatePanel,
  StatusBadge,
  Surface,
} from "../components";
import { CeacIcon } from "../icons";
import { dueLabel, isOverdue, since } from "../../lib/time";

function accraDateKey(value = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Accra",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const pick = (type) => parts.find((part) => part.type === type)?.value;
  return `${pick("year")}-${pick("month")}-${pick("day")}`;
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

function titleCase(value = "") {
  return String(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function workStatus(item) {
  if (!item) return { label: "", tone: "neutral" };
  if (item.status === "returned") return { label: "Sent back", tone: "danger" };
  if (isOverdue(item.due_at) && !["completed", "self_certified", "cancelled"].includes(item.status)) {
    return { label: "Overdue", tone: "danger" };
  }

  const statuses = {
    not_started: ["Not started", "neutral"],
    in_progress: ["In progress", "action"],
    in_review: ["In review", "warning"],
    waiting_on: ["Waiting", "neutral"],
    completed: ["Completed", "success"],
    self_certified: ["Completed", "success"],
    cancelled: ["Cancelled", "neutral"],
  };
  const [label, tone] = statuses[item.status] || [titleCase(item.status || "Work"), "neutral"];
  return { label, tone };
}

function StaticRow({ icon, title, meta, note }) {
  return (
    <div className="staffv2-static-row">
      <span className="staffv2-static-icon"><CeacIcon name={icon} size="row" decorative /></span>
      <span className="staffv2-static-copy">
        <strong>{title}</strong>
        {meta ? <span>{meta}</span> : null}
        {note ? <small>{note}</small> : null}
      </span>
    </div>
  );
}

export default function StaffTodayV2({
  me,
  session,
  staleSession,
  busy,
  sessionVerified = true,
  greeting,
  todayLabel,
  loading,
  loadFailed,
  error,
  primaryNextItem,
  nextMeeting,
  nextMoveItems = [],
  visibleAlerts = [],
  announcementAttention = [],
  feedback = [],
  completedThisWeek = [],
  leaveUpdates = [],
  roomMentions = [],
  waitingReviews = [],
  waitingDependencies = [],
  reviewSubmissions = [],
  dueSoon = [],
  upcomingMeetings = [],
  calendarEvents = [],
  birthdays = [],
  upcomingLeave = [],
  announcements = [],
  dueThisWeek = [],
  overdue = [],
  drill,
  drillRows = [],
  onStartWork,
  onEndWork,
  onReviewSession,
  onContinueRecoveredSession,
  onCloseRecoveredSession,
  onOpenItem,
  onOpenMeeting,
  onOpenRoom,
  onOpenAnnouncements,
  onOpenEvent,
  onRetry,
  onSelectDrill,
  getReviewFollowupState,
  getBlockerFor,
  getBlockerFollowupState,
  onFollowUpReview,
  onFollowUpDependency,
  ministryRecord,
}) {
  const todayKey = accraDateKey();
  const todaySchedule = [
    ...upcomingMeetings.map((meeting) => ({
      id: `meeting-${meeting.id}`,
      type: "meeting",
      title: meeting.title,
      startsAt: meeting.starts_at,
      source: meeting,
    })),
    ...calendarEvents.map((event) => ({
      id: `event-${event.id}`,
      type: "event",
      title: event.cancelled ? `Cancelled · ${event.title}` : event.title,
      startsAt: event.starts_at,
      source: event,
    })),
  ]
    .filter((entry) => accraDateKey(entry.startsAt) === todayKey)
    .sort((left, right) => new Date(left.startsAt) - new Date(right.startsAt))
    .slice(0, 4);

  const futureMeetings = upcomingMeetings.filter((meeting) => accraDateKey(meeting.starts_at) !== todayKey);
  const futureEvents = calendarEvents.filter((event) => accraDateKey(event.starts_at) !== todayKey);
  const comingEntries = [
    ...dueSoon
      .filter((item) => item.id !== primaryNextItem?.id)
      .map((item) => ({
        id: `work-${item.id}`,
        type: "work",
        at: item.due_at || "9999-12-31",
        title: item.title,
        meta: `${item.ref} · ${dueLabel(item.due_at)}`,
        source: item,
      })),
    ...futureMeetings.map((meeting) => ({
      id: `meeting-${meeting.id}`,
      type: "meeting",
      at: meeting.starts_at,
      title: meeting.title,
      meta: `${formatDate(meeting.starts_at, { weekday: "short", hour: "2-digit", minute: "2-digit" })} · ${meeting.provider === "zoom" ? "Zoom" : "Meeting"}`,
      source: meeting,
    })),
    ...futureEvents.map((event) => ({
      id: `event-${event.id}`,
      type: "event",
      at: event.starts_at,
      title: event.cancelled ? `Cancelled · ${event.title}` : event.title,
      meta: `${formatDate(event.starts_at, event.all_day ? { weekday: "short" } : { weekday: "short", hour: "2-digit", minute: "2-digit" })}${event.location ? ` · ${event.location}` : ""}`,
      source: event,
    })),
    ...birthdays.map((profile) => ({
      id: `birthday-${profile.id}`,
      type: "birthday",
      at: profile.nextBirthday,
      title: `${profile.full_name}'s birthday`,
      meta: profile.nextBirthday.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }),
      source: profile,
    })),
    ...upcomingLeave.map((request) => ({
      id: `leave-${request.id}`,
      type: "leave",
      at: `${request.start_date}T00:00:00`,
      title: `Your approved ${request.kind} leave begins`,
      meta: new Date(`${request.start_date}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }),
      source: request,
    })),
  ]
    .sort((left, right) => new Date(left.at) - new Date(right.at))
    .slice(0, 6);

  const updateCount =
    roomMentions.slice(0, 3).length +
    feedback.slice(0, 2).length +
    completedThisWeek.slice(0, 2).length +
    leaveUpdates.slice(0, 2).length;
  const waitingCount = waitingReviews.length + waitingDependencies.length;
  const attentionCount = nextMoveItems.length + visibleAlerts.length + announcementAttention.length;

  const focusStatus = primaryNextItem ? workStatus(primaryNextItem) : null;
  const focusTitle = primaryNextItem
    ? primaryNextItem.title
    : nextMeeting
      ? nextMeeting.title
      : "You're clear for now";
  const focusSupporting = primaryNextItem
    ? `${primaryNextItem.ref} · ${dueLabel(primaryNextItem.due_at)}`
    : nextMeeting
      ? `${formatDate(nextMeeting.starts_at, { weekday: "short", hour: "2-digit", minute: "2-digit" })} · ${nextMeeting.provider === "zoom" ? "Zoom" : "Meeting"}`
      : "No urgent work or upcoming meeting needs your action right now.";

  return (
    <div className="body staff-home">
      <div className="staffv2">
        <header className="staffv2-intro s2-landscape-hero"><DailyScenicPhoto />
          <div className="staffv2-context">
            <span>{me.unit_name}</span>
            <time>{todayLabel}</time>
          </div>
          <h1>{greeting}, {me.full_name.split(" ")[0]}</h1>
          <p>Your work, updates and next steps in one calm workspace.</p>
        </header>

        <Surface
          as="section"
          variant={session && !staleSession ? "soft" : "plain"}
          padding="standard"
          className={`staffv2-session ${session ? "is-active" : ""} ${staleSession ? "needs-review" : ""}`}
          aria-label="Work session"
        >
          <span className="staffv2-session-icon">
            <CeacIcon name={staleSession ? "warning" : "work"} size="feature" decorative />
          </span>
          <div className="staffv2-session-copy">
            <div className="staffv2-session-label">Work session</div>
            <div className="staffv2-session-line">
              <strong>{!sessionVerified ? "Verification required" : session ? staleSession ? "Needs reconciliation" : since(session.started_at) : "Not working"}</strong>
              <StatusBadge tone={!sessionVerified ? "warning" : staleSession ? "warning" : session ? "success" : "neutral"}>
                {!sessionVerified ? "Unverified" : staleSession ? "Review needed" : session ? "Active" : "Not started"}
              </StatusBadge>
            </div>
            <span>
              {!sessionVerified ? "Work-session actions are paused pending server verification." : session
                ? staleSession
                  ? "The running duration is paused until you confirm what happened."
                  : `Started ${new Date(session.started_at).toLocaleTimeString("en-GB", { timeZone: "Africa/Accra", hour: "2-digit", minute: "2-digit" })} · ${session.place === "office" ? "At the office" : "Working off-site"}`
                : "Start when you begin CEAC work."}
            </span>
          </div>
          <div className="staffv2-session-actions">
            {session
              ? staleSession
                ? <Button variant="secondary" onClick={onReviewSession} disabled={busy || !sessionVerified}>Review</Button>
                : <Button variant="secondary" onClick={onEndWork} disabled={busy || !sessionVerified}>End work</Button>
              : <Button onClick={onStartWork} disabled={busy || !sessionVerified}>Start work</Button>}
          </div>
        </Surface>

        {staleSession ? (
          <Surface variant="soft" padding="standard" className="staffv2-recovery">
            <span className="staffv2-recovery-icon"><CeacIcon name="warning" size="row" decorative /></span>
            <div>
              <strong>Earlier work session still open</strong>
              <p>CEAC OS will not record continuous overnight work by itself. Start a new day using the previous working location, or close it at the actual time.</p>
            </div>
            <div className="staffv2-recovery-actions">
              <Button onClick={onContinueRecoveredSession} disabled={busy || !sessionVerified}>Start a new day</Button>
              <Button variant="secondary" onClick={onCloseRecoveredSession} disabled={busy || !sessionVerified}>Close at the actual time</Button>
            </div>
          </Surface>
        ) : null}

        {loadFailed ? (
          <StatePanel
            state="error"
            title="Today could not finish loading"
            description={error || "Some of your current work could not be loaded."}
            actionLabel="Try again"
            onAction={onRetry}
          />
        ) : error ? (
          <Surface as="div" variant="soft" padding="standard" className="staffv2-notice" role="alert">
            <CeacIcon name="error" size="row" decorative />
            <div><strong>Could not complete that</strong><span>{error}</span></div>
          </Surface>
        ) : null}

        {loading ? (
          <div className="staffv2-loading" role="status" aria-live="polite" aria-busy="true" aria-label="Loading Today">
            <Surface variant="plain" padding="standard">
              <Skeleton width="38%" />
              <Skeleton width="82%" />
              <Skeleton width="64%" />
            </Surface>
            <Surface variant="plain" padding="standard">
              <Skeleton width="32%" />
              <Skeleton width="100%" />
              <Skeleton width="88%" />
            </Surface>
          </div>
        ) : null}

        {!loading && !loadFailed ? (
          <>
            <section className="staffv2-focus-grid" aria-label="Next action and today's schedule">
              <ActionFocusCard
                className="staffv2-focus-card"
                eyebrow="Next up"
                title={focusTitle}
                supporting={focusSupporting}
                icon={primaryNextItem ? "work" : nextMeeting ? "meeting" : "checkCircle"}
                status={primaryNextItem ? focusStatus.label : nextMeeting ? "Meeting" : "Clear"}
                statusTone={primaryNextItem ? focusStatus.tone : nextMeeting ? "action" : "success"}
                actionLabel={primaryNextItem ? "Continue work" : nextMeeting ? "Open meeting" : undefined}
                onAction={primaryNextItem
                  ? () => onOpenItem?.(primaryNextItem.id)
                  : nextMeeting
                    ? () => onOpenMeeting?.(nextMeeting.id)
                    : undefined}
              />

              <DataPanel
                className="staffv2-schedule-panel"
                eyebrow="Today"
                title="Schedule"
                supporting={todayLabel}
              >
                {todaySchedule.length ? todaySchedule.map((entry) => {
                  const isMeeting = entry.type === "meeting";
                  const event = entry.source;
                  return (
                    <QueueRow
                      key={entry.id}
                      icon={isMeeting ? "meeting" : "calendar"}
                      title={entry.title}
                      meta={formatDate(entry.startsAt, { hour: "2-digit", minute: "2-digit" })}
                      status={event.cancelled ? "Cancelled" : isMeeting ? "Meeting" : titleCase(event.kind || "Event")}
                      statusTone={event.cancelled ? "danger" : isMeeting ? "action" : "neutral"}
                      onClick={isMeeting
                        ? () => onOpenMeeting?.(event.id)
                        : () => onOpenEvent?.(event)}
                    />
                  );
                }) : (
                  <div className="staffv2-clear">
                    <CeacIcon name="calendar" size="row" decorative />
                    <span>No meeting or event is recorded for today.</span>
                  </div>
                )}
              </DataPanel>
            </section>

            <div className="staffv2-main-grid">
              {attentionCount > 0 ? (
                <DataPanel
                  className="staffv2-panel staffv2-attention"
                  eyebrow="Actionable now"
                  title="Needs your attention"
                  action={<span className="staffv2-count">{attentionCount}</span>}
                >
                  {nextMoveItems.map((item) => {
                    const status = workStatus(item);
                    return (
                      <QueueRow
                        key={item.id}
                        icon={item.status === "returned" ? "warning" : "work"}
                        title={item.title}
                        meta={`${item.ref} · ${dueLabel(item.due_at)}`}
                        status={status.label}
                        statusTone={status.tone}
                        onClick={() => onOpenItem?.(item.id)}
                      />
                    );
                  })}
                  {visibleAlerts.map((alert) => (
                    <QueueRow
                      key={alert.id}
                      icon="warning"
                      title={alert.message}
                      meta={`Since ${new Date(alert.first_seen_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`}
                      status="Attention"
                      statusTone="warning"
                      onClick={alert.subject_id ? () => onOpenItem?.(alert.subject_id) : undefined}
                    />
                  ))}
                  {announcementAttention.map((announcement) => (
                    <QueueRow
                      key={`ack-${announcement.id}`}
                      icon="notification"
                      title={`Acknowledge: ${announcement.title}`}
                      meta="Organisation announcement"
                      status="Acknowledge"
                      statusTone="warning"
                      onClick={onOpenAnnouncements}
                    />
                  ))}
                </DataPanel>
              ) : null}

              {updateCount > 0 ? (
                <DataPanel
                  className="staffv2-panel staffv2-updates"
                  eyebrow="Since you last checked"
                  title="Updates"
                  action={<span className="staffv2-count">{updateCount}</span>}
                >
                  {roomMentions.slice(0, 3).map((message) => {
                    const room = message.rooms;
                    const roomName = room?.kind === "project"
                      ? room.projects?.name
                      : room?.kind === "sub_team"
                        ? room.sub_teams?.name
                        : room?.units?.name;
                    return (
                      <QueueRow
                        key={`mention-${message.id}`}
                        icon="messages"
                        title={`${message.profiles?.full_name || "A teammate"} mentioned you`}
                        meta={`${roomName || "Room"} · ${new Date(message.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`}
                        onClick={() => onOpenRoom?.({
                          kind: room?.kind,
                          unitId: room?.unit_id,
                          subTeamId: room?.sub_team_id,
                          projectId: room?.project_id,
                        })}
                      />
                    );
                  })}
                  {feedback.slice(0, 2).map((note) => (
                    <StaticRow
                      key={note.id}
                      icon="record"
                      title={`${note.profiles?.full_name || "Manager"} left feedback`}
                      meta={new Date(note.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                      note={note.note}
                    />
                  ))}
                  {completedThisWeek.slice(0, 2).map((item) => (
                    <QueueRow
                      key={`completed-${item.id}`}
                      icon="checkCircle"
                      title={item.title}
                      meta={`${item.ref} · completed ${new Date(item.completed_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`}
                      status="Completed"
                      statusTone="success"
                      onClick={() => onOpenItem?.(item.id)}
                    />
                  ))}
                  {leaveUpdates.slice(0, 2).map((request) => (
                    <StaticRow
                      key={`leave-update-${request.id}`}
                      icon="time"
                      title={`Your leave request was ${request.status}`}
                      meta={`${request.kind} leave · ${request.start_date} to ${request.end_date}`}
                      note={request.decision_note}
                    />
                  ))}
                </DataPanel>
              ) : null}

              {waitingCount > 0 ? (
                <DataPanel
                  className="staffv2-panel staffv2-waiting"
                  eyebrow="Already moved from your side"
                  title="Waiting on others"
                  action={<span className="staffv2-count">{waitingCount}</span>}
                >
                  {waitingReviews.map((item) => {
                    const follow = getReviewFollowupState?.(item) || {};
                    const submission = reviewSubmissions.find((row) => row.work_item_id === item.id);
                    return (
                      <div className="staffv2-wait-row" key={`review-${item.id}`}>
                        <button type="button" className="staffv2-wait-main" onClick={() => onOpenItem?.(item.id)}>
                          <span className="staffv2-wait-icon"><CeacIcon name="pending" size="row" decorative /></span>
                          <span>
                            <strong>{item.title}</strong>
                            <small>{item.ref} · sent {submission ? new Date(submission.submitted_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "for review"}</small>
                            <span>Waiting for your manager to check it.</span>
                          </span>
                        </button>
                        <div className="staffv2-wait-action">
                          {follow.canFollowUp
                            ? <Button variant="quiet" size="compact" disabled={busy} onClick={() => onFollowUpReview?.(item.id)}>{follow.label}</Button>
                            : <span>{follow.label || "Waiting for review"}</span>}
                        </div>
                      </div>
                    );
                  })}

                  {waitingDependencies.map((item) => {
                    const blocker = getBlockerFor?.(item);
                    const follow = getBlockerFollowupState?.(blocker) || {};
                    return (
                      <div className="staffv2-wait-row" key={`waiting-${item.id}`}>
                        <button type="button" className="staffv2-wait-main" onClick={() => onOpenItem?.(item.id)}>
                          <span className="staffv2-wait-icon"><CeacIcon name="pending" size="row" decorative /></span>
                          <span>
                            <strong>{item.title}</strong>
                            <small>{item.ref}{blocker ? ` · ${blocker.units?.name || blocker.party_text}` : ""}</small>
                            <span>{blocker?.state === "acknowledged" ? "The dependency has been acknowledged." : "Waiting for a response."}</span>
                          </span>
                        </button>
                        <div className="staffv2-wait-action">
                          {follow.canFollowUp && blocker
                            ? <Button variant="quiet" size="compact" disabled={busy} onClick={() => onFollowUpDependency?.(blocker.id)}>{follow.label}</Button>
                            : <span>{follow.label || "Waiting on another unit"}</span>}
                        </div>
                      </div>
                    );
                  })}
                </DataPanel>
              ) : null}

              {comingEntries.length > 0 ? (
                <DataPanel
                  className="staffv2-panel staffv2-coming"
                  eyebrow="Next few days"
                  title="Coming up"
                >
                  {comingEntries.map((entry) => {
                    if (entry.type === "work") {
                      const status = workStatus(entry.source);
                      return (
                        <QueueRow
                          key={entry.id}
                          icon="work"
                          title={entry.title}
                          meta={entry.meta}
                          status={status.label}
                          statusTone={status.tone}
                          onClick={() => onOpenItem?.(entry.source.id)}
                        />
                      );
                    }
                    if (entry.type === "meeting") {
                      return (
                        <QueueRow
                          key={entry.id}
                          icon="meeting"
                          title={entry.title}
                          meta={entry.meta}
                          status="Meeting"
                          statusTone="action"
                          onClick={() => onOpenMeeting?.(entry.source.id)}
                        />
                      );
                    }
                    if (entry.type === "event") {
                      return (
                        <QueueRow
                          key={entry.id}
                          icon="calendar"
                          title={entry.title}
                          meta={entry.meta}
                          status={entry.source.cancelled ? "Cancelled" : titleCase(entry.source.kind || "Event")}
                          statusTone={entry.source.cancelled ? "danger" : "neutral"}
                          onClick={() => onOpenEvent?.(entry.source)}
                        />
                      );
                    }
                    return (
                      <StaticRow
                        key={entry.id}
                        icon={entry.type === "birthday" ? "person" : "time"}
                        title={entry.title}
                        meta={entry.meta}
                      />
                    );
                  })}
                </DataPanel>
              ) : null}
            </div>

            <div className="staffv2-secondary-grid">
              <DataPanel
                className="staffv2-panel staffv2-week"
                eyebrow="Your factual record"
                title="This week"
              >
                <div className="staffv2-week-stats">
                  <button type="button" onClick={() => onSelectDrill?.({ title: "Work due this week", rows: dueThisWeek })}>
                    <strong>{dueThisWeek.length}</strong>
                    <span>Due</span>
                  </button>
                  <button type="button" onClick={() => onSelectDrill?.({ title: "Work completed this week", rows: completedThisWeek })}>
                    <strong>{completedThisWeek.length}</strong>
                    <span>Completed</span>
                  </button>
                  <button type="button" onClick={() => onSelectDrill?.({ title: "Overdue work", rows: overdue })}>
                    <strong>{overdue.length}</strong>
                    <span>Overdue</span>
                  </button>
                </div>

                {drill ? (
                  <div className="staffv2-drill">
                    <div className="staffv2-drill-head">
                      <strong>{drill.title}</strong>
                      <span>{drillRows.length}</span>
                    </div>
                    {drillRows.length
                      ? drillRows.map((item) => {
                          const status = workStatus(item);
                          return (
                            <QueueRow
                              key={item.id}
                              icon="work"
                              title={item.title}
                              meta={`${item.ref} · ${dueLabel(item.due_at)}`}
                              status={status.label}
                              statusTone={status.tone}
                              onClick={() => onOpenItem?.(item.id)}
                            />
                          );
                        })
                      : <div className="staffv2-clear"><span>No work is in this group.</span></div>}
                  </div>
                ) : null}
              </DataPanel>

              {announcements.length > 0 ? (
                <DataPanel
                  className="staffv2-panel staffv2-announcements"
                  eyebrow="From CEAC"
                  title="Announcements"
                  action={<Button variant="quiet" size="compact" onClick={onOpenAnnouncements}>See all</Button>}
                >
                  {announcements.slice(0, 2).map((announcement) => {
                    const receipt = (announcement.announcement_receipts || []).find((entry) => entry.profile_id === me.id);
                    const needsAcknowledgement = announcement.requires_acknowledgement && !receipt?.acknowledged_at;
                    return (
                      <QueueRow
                        key={announcement.id}
                        icon="notification"
                        title={announcement.title}
                        meta={`${announcement.priority !== "normal" ? `${titleCase(announcement.priority)} · ` : ""}${announcement.profiles?.full_name || "CEAC"}`}
                        status={needsAcknowledgement ? "Acknowledge" : !receipt ? "New" : undefined}
                        statusTone={needsAcknowledgement ? "warning" : "action"}
                        onClick={onOpenAnnouncements}
                      />
                    );
                  })}
                </DataPanel>
              ) : null}

              {ministryRecord ? (
                <section className="staffv2-ministry-record" aria-label="Ministry record">
                  {ministryRecord}
                </section>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
