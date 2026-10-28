import { useEffect, useRef, useState } from "react";
import "../final-product/fpg7-people-workforce.css";
import { supabase } from "../lib/supabase";
import { classifyPreviewFeatureResult } from "../lib/pendingFeatureCompatibility";
import { dateOnly, dueLabel } from "../lib/time";
import { statusPill, ProductNotice, LoadingState, FieldGroup, EmptyState, Avatar, ProgressMeter } from "../components/bits";
import { humanError } from "../lib/productLanguage";
import { protectedMoney, amountToMinor } from "../lib/protectedCompensation";
import {
  OPERATIONAL_FILE_ACCEPT,
  listOperationalFiles,
  listOperationalFilesForContexts,
  openOperationalFile,
  signedOperationalFileUrl,
  uploadOperationalFile,
} from "../lib/operationalFiles";
import { Button, ComposerDrawer } from "../experience-v2/components";
import PeopleAccess from "../components/PeopleAccess";
import EmployeeScheduleEditor from "../components/EmployeeScheduleEditor";
import RosterOnlyEmploymentEditor from "../components/RosterOnlyEmploymentEditor";
import LinkedEmployeeContactEditor from "../components/LinkedEmployeeContactEditor";
import RosterAccountLink from "../components/RosterAccountLink";
import HRCreateRosterEmployee from "../components/HRCreateRosterEmployee";
import EmployeeDossierRecords from "../components/EmployeeDossierRecords";
import EmployeeAttendanceObservations from "../components/EmployeeAttendanceObservations";
import {
  PeopleAdminPersonRow,
  PeopleBackButton,
  PeopleEmpty,
  PeopleEvidenceSummary,
  PeopleFactRow,
  PeoplePageHeader,
  PeoplePersonHeader,
  PeoplePersonRow,
  PeopleSection,
  PeopleWorkspaceSection,
} from "../experience-v2/people-family/PeopleFamilyV2";

const PEOPLE_VIEWS = [["directory","Directory"],["access","Access"],["organisation","Organisation"],["attention","Needs attention"]];
const PERSON_TABS = [["overview","Overview"],["access","Access"],["employment","Employment"],["work","Work"],["time","Time & Leave"],["development","Development"],["learning","Learning"],["equipment","Equipment"],["documents","Documents"],["history","History"]];
const FILTERS = [["all","Everyone"],["active","Active"],["on_leave","On leave"],["quiet","No submissions in 14 days"],["no_unit","No unit"]];
const EMPLOYMENT_CHANGES = [
  ["employment_details_changed","Employment details changed"],
  ["transferred","Transfer"],
  ["promoted","Promotion / title change"],
  ["manager_changed","Manager changed"],
  ["role_changed","Role changed"],
  ["working_pattern_changed","Working pattern changed"],
  ["status_changed","Status changed"],
  ["exit_recorded","Exit recorded"],
  ["correction","Correction"],
];

function employmentChangeLabel(value) {
  return EMPLOYMENT_CHANGES.find(([key]) => key === value)?.[1]
    || (value === "joined" ? "Joined" : value === "baseline_import" ? "Baseline record" : value);
}

function avgStartLabel(minutes) {
  if (minutes == null || Number.isNaN(Number(minutes))) return "—";
  const value = Number(minutes);
  return String(Math.floor(value / 60)).padStart(2, "0") + ":" + String(value % 60).padStart(2, "0");
}

export default function People({ me, openItem, go, openLifecycle, onManagePermissions=null, accessIntent = null, onAccessIntentHandled, initialEmployeeId = null, onInitialHandled }) {
  const [rows, setRows] = useState([]);
  const [creatingEmployee,setCreatingEmployee] = useState(false);
  const [operationalDirectory, setOperationalDirectory] = useState([]);
  const [filter, setFilter] = useState("all");
  const [viewMode, setViewMode] = useState("directory");
  const [personTab, setPersonTab] = useState("overview");
  const [rosterEditRequest,setRosterEditRequest] = useState({ employeeId:null, seq:0 });
  const [searchText, setSearchText] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [accessFocusProfileId, setAccessFocusProfileId] = useState(null);
  const [accessFocusUnitId, setAccessFocusUnitId] = useState(null);
  const [accessFocusMode, setAccessFocusMode] = useState(null);
  const [accessInviteRoster,setAccessInviteRoster] = useState(null);
  const [leavePolicy, setLeavePolicy] = useState(null);
  const [units, setUnits] = useState([]);
  const [person, setPerson] = useState(null);
  const [employmentEditor, setEmploymentEditor] = useState(false);
  const [employmentForm, setEmploymentForm] = useState(null);
  const [savingEmployment, setSavingEmployment] = useState(false);
  const [volunteerRecommendations, setVolunteerRecommendations] = useState([]);
  const [volunteerRecommendationsAvailable, setVolunteerRecommendationsAvailable] = useState(true);
  const [volunteerDecisionBusy, setVolunteerDecisionBusy] = useState(false);
  const [protectedHr, setProtectedHr] = useState(null);
  const [protectedHrLoading, setProtectedHrLoading] = useState(false);
  const [protectedEditor, setProtectedEditor] = useState(null);
  const [savingProtected, setSavingProtected] = useState(false);
  const [employeeFiles, setEmployeeFiles] = useState({ photos: [], documents: [] });
  const [employeeFileBusy, setEmployeeFileBusy] = useState(false);
  const [drill, setDrill] = useState(null);
  const [loading, setLoading] = useState(true);
  const [verifiedRosterScope, setVerifiedRosterScope] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState(null);
  const scopeKey = `${me.org_id}:${me.id}`;
  const rosterGeneration = useRef(0);
  const initialSelectionScope = useRef(null);
  const personGeneration = useRef(0);
  const protectedWriteBusy = useRef(false);
  const employmentWriteBusy = useRef(false);
  const recommendationWriteBusy = useRef(false);
  const employeeFileWriteBusy = useRef(false);

  const canManageProtectedHr = (me.capabilities || []).includes("hr_private.access");
  function clearEditorsForNavigation() {
    setSavingProtected(false);
    setSavingEmployment(false);
    setVolunteerDecisionBusy(false);
    setProtectedEditor(null);
    setEmploymentEditor(false);
    setEmploymentForm(null);
  }

  useEffect(() => {
    // Invitation prefill may contain a person's private HR contact details.
    // Never retain a selection when the signed HR actor or tenant changes.
    setCreatingEmployee(false);
    setAccessInviteRoster(null);
    void load();
    return () => { rosterGeneration.current += 1; personGeneration.current += 1; };
  }, [me.id, me.org_id]);
  useEffect(() => {
    if (!initialEmployeeId || !rows.length || person || accessIntent) return;
    const match = rows.find((row) => row.id === initialEmployeeId || row.profile_id === initialEmployeeId);
    if (!match) return;
    openPerson(match);
    onInitialHandled?.();
  }, [initialEmployeeId, rows, person, accessIntent]);
  useEffect(() => {
    if (!accessIntent) return;
    // Deep-link to access administration wins over any slower employee
    // detail request that was in flight when navigation occurred.
    personGeneration.current += 1;
    employeeFileWriteBusy.current = false;
    setEmployeeFileBusy(false);
    clearEditorsForNavigation();
    setPerson(null);
    setProtectedHr(null);
    setDetailLoading(false);
    setProtectedHrLoading(false);
    setAccessFocusProfileId(accessIntent.profileId || null);
    setAccessFocusUnitId(accessIntent.unitId || null);
    setAccessFocusMode(accessIntent.mode || null);
    setAccessInviteRoster(null);
    setViewMode("access");
    onAccessIntentHandled?.();
  }, [accessIntent]);

  useEffect(() => {
    if (verifiedRosterScope !== scopeKey || !rows.length || person || detailLoading || initialEmployeeId || accessIntent || viewMode !== "directory") return;
    if (initialSelectionScope.current === scopeKey || !window.matchMedia("(min-width: 901px)").matches) return;
    initialSelectionScope.current = scopeKey;
    void openPerson(rows[0]);
  }, [verifiedRosterScope, scopeKey, rows, person, detailLoading, initialEmployeeId, accessIntent, viewMode]);

  async function load({ silent = false } = {}) {
    const generation = ++rosterGeneration.current;
    if (!silent) { setLoading(true); setVerifiedRosterScope(null); }
    setError(null);
    try {
    const [rosterResult, peopleResult, versionsResult, rulesResult, unitsResult] = await Promise.all([
      supabase.rpc("admin_employee_roster_summary"),
      supabase.rpc("admin_people_summary"),
      supabase.from("leave_policy_versions").select("id,state,effective_from,effective_to,confirmed_at")
        .eq("org_id",me.org_id).eq("state","active")
        .order("effective_from",{ascending:false}),
      supabase.from("leave_policy_rules").select("policy_version_id,leave_kind,entitlement_amount,accrual_rate,complete")
        .eq("org_id",me.org_id).eq("leave_kind","annual"),
      supabase.from("units").select("id,name,unit_memberships(profile_id,role,profiles(active))").eq("org_id", me.org_id).eq("active", true).order("name"),
    ]);
    if (generation !== rosterGeneration.current) return false;
    if (rosterResult.error || peopleResult.error) {
      setVerifiedRosterScope(null);
      setError(humanError(rosterResult.error || peopleResult.error, "The People record could not load."));
      setLoading(false);
      return false;
    }
    if (versionsResult.error || rulesResult.error) {
      setVerifiedRosterScope(null);
      setError(humanError(versionsResult.error || rulesResult.error, "The confirmed leave-policy source could not load."));
      setLoading(false);
      return false;
    }
    if (unitsResult.error) {
      setVerifiedRosterScope(null);
      setError(humanError(unitsResult.error, "Organisation units could not load."));
      setLoading(false);
      return false;
    }
    const operationalPeople = Array.isArray(peopleResult.data) ? peopleResult.data : [];
    const operationalByProfile = new Map(operationalPeople.map((entry) => [entry.id, entry]));
    const rosterRows = (Array.isArray(rosterResult.data) ? rosterResult.data : []).map((employee) => {
      const operational = employee.profile_id ? operationalByProfile.get(employee.profile_id) : null;
      const rosterUnits = Array.isArray(employee.units) ? employee.units : [];
      const primaryUnit = rosterUnits.find((unit) => unit.is_primary) || rosterUnits[0] || null;
      return {
        ...(operational || {}),
        id: employee.id,
        employee_id: employee.id,
        profile_id: employee.profile_id || null,
        full_name: employee.full_name,
        preferred_name: employee.preferred_name || null,
        source_display_name: employee.source_display_name || null,
        source_department_text: employee.source_department_text || null,
        source_position: employee.source_position || null,
        job_title: employee.job_title || operational?.job_title || null,
        // Linked employment edits update profiles.contract_type atomically with
        // employment_records; the independent roster can retain its import value.
        employment_type: operational?.contract_type || employee.employment_type || "not_recorded",
        employment_status: employee.employment_status || "active",
        identity_state: employee.identity_state,
        responsibility_context: Array.isArray(employee.responsibility_context) ? employee.responsibility_context : [],
        review_note: employee.review_note || null,
        roster_units: rosterUnits,
        email: employee.account_email || operational?.email || null,
        account_active: employee.account_active ?? operational?.active ?? false,
        active: employee.employment_status === "active",
        unit_id: operational?.unit_id || primaryUnit?.unit_id || null,
        unit_name: operational?.unit_name || primaryUnit?.unit_name || null,
        role: operational?.role || null,
        is_admin: employee.is_admin || operational?.is_admin || false,
        is_exec: employee.is_exec || operational?.is_exec || false,
        is_operational_manager: employee.is_operational_manager || operational?.role === "manager",
        on_leave_now: operational?.on_leave_now || false,
        quiet: operational?.quiet || false,
        done_count: operational?.done_count || 0,
        assigned_done_count: operational?.assigned_done_count || 0,
        self_done_count: operational?.self_done_count || 0,
        on_time_count: operational?.on_time_count || 0,
        first_time_count: operational?.first_time_count || 0,
        open_count: operational?.open_count || 0,
        days_this_month: operational?.days_this_month || 0,
        avg_start_minutes: operational?.avg_start_minutes ?? null,
        annual_taken: operational?.annual_taken || 0,
        sick_taken: operational?.sick_taken || 0,
        carryover_from_last_year: operational?.carryover_from_last_year || 0,
        started_on: operational?.started_on || employee.hr_started_on || null,
        contract_type: operational?.contract_type || employee.employment_type || "not_recorded",
        birthday: operational?.birthday || null,
        phone: operational?.phone || null,
      };
    });
    // Publish the permission-verified roster before fetching optional private
    // employee photos. A slow Storage signed-URL request must never block
    // legitimate People & Access / HR actions or tempt anyone to bypass RLS.
    if (generation !== rosterGeneration.current) return false;
    setVerifiedRosterScope(scopeKey);
    setOperationalDirectory(operationalPeople.map((entry)=>({
      id:entry.id,full_name:entry.full_name,email:entry.email||null,
      active:entry.active,unit_id:entry.unit_id,unit_name:entry.unit_name,
      role:entry.role,
    })));
    setRows(rosterRows);
    // Only a dated active version with a complete annual rule can present
    // entitlement. Legacy leave_settings values are not an activated policy.
    const asOf=new Date().toISOString().slice(0,10);
    const activeVersion=(versionsResult.data||[]).find(version=>version.confirmed_at
      &&version.effective_from<=asOf
      &&(!version.effective_to||version.effective_to>=asOf));
    const annualRule=(rulesResult.data||[]).find(rule=>rule.policy_version_id===activeVersion?.id
      &&rule.leave_kind==="annual"&&rule.complete
      &&rule.entitlement_amount!==null&&rule.entitlement_amount!==undefined
      &&rule.accrual_rate!==null&&rule.accrual_rate!==undefined
      &&Number.isFinite(Number(rule.entitlement_amount))
      &&Number.isFinite(Number(rule.accrual_rate)));
    setLeavePolicy(activeVersion&&annualRule
      ?{annual_days:Number(annualRule.entitlement_amount),confirmed_at:activeVersion.confirmed_at}
      :null);
    setUnits(unitsResult.data || []);
    setLoading(false);

    // Photos remain strictly context-scoped: the request runs only after
    // privileged roster access succeeds and can neither expose a previous
    // organisation's rows nor replace newer search/filter/roster generations.
    void (async () => {
      try {
        const photoGroups = await listOperationalFilesForContexts(
          "employee_photo", rosterRows.map((entry) => entry.id)
        );
        const hydratedRows = await Promise.all(rosterRows.map(async (entry) => {
          const files = photoGroups.get(entry.id) || [];
          const latest = files[files.length - 1] || null;
          if (!latest) return entry;
          try {
            return { ...entry, photo_url: await signedOperationalFileUrl(latest, 3600) };
          } catch {
            return entry;
          }
        }));
        if (generation === rosterGeneration.current) setRows(hydratedRows);
      } catch {
        // Optional private media failure must never erase an authorised roster.
        // The photo is simply unavailable; no public Storage URL is substituted.
      }
    })();
    return true;
    } catch (failure) {
      if (generation === rosterGeneration.current) {
        setVerifiedRosterScope(null);
        setError(humanError(failure, "People records could not be verified. Retry before making changes."));
        setLoading(false);
      }
      return false;
    }
  }

  async function openPerson(summary) {
    setViewMode("directory");
    const generation = ++personGeneration.current;
    employeeFileWriteBusy.current = false;
    setEmployeeFileBusy(false);
    clearEditorsForNavigation();
    setPerson(null);
    setProtectedHr(null);
    setVolunteerRecommendations([]);
    setEmployeeFiles({ photos: [], documents: [] });
    setVolunteerRecommendationsAvailable(true);
    setDetailLoading(true);
    setError(null);
    setDrill(null);
    setPersonTab("overview");

    try {
    const [rosterDetailResult,hrContactResult] = await Promise.all([
      supabase.rpc("admin_employee_roster_detail", { p_employee_id: summary.id }),
      supabase.from("employee_roster")
        .select("id,org_id,profile_id,hr_contact_email,hr_contact_phone,hr_started_on")
        .eq("org_id",me.org_id).eq("id",summary.id).single(),
    ]);
    if (generation !== personGeneration.current) return;
    if (rosterDetailResult.error || hrContactResult.error
      || hrContactResult.data?.id !== summary.id
      || hrContactResult.data.org_id !== me.org_id
      || (hrContactResult.data.profile_id || null) !== (summary.profile_id || null)) {
      setDetailLoading(false);
      setError(humanError(rosterDetailResult.error || hrContactResult.error,
        "That employee's authorised roster and HR contact records could not be reconciled."));
      return;
    }

    let detailResult = { data: { work: [], sessions: [], leave: [] }, error: null };
    let employmentResult = { data: { current: null, history: [] }, error: null };
    let protectedResult = { data: null, error: null };

    const linkedRequests = summary.profile_id
      ? Promise.all([
          supabase.rpc("admin_person_detail", { p_profile_id: summary.profile_id }),
          supabase.rpc("admin_employment_detail", { p_profile_id: summary.profile_id }),
        ])
      : Promise.resolve([{ data: { work: [], sessions: [], leave: [] }, error: null }, { data: { current: null, history: [] }, error: null }]);

    setProtectedHrLoading(canManageProtectedHr);
    let linkedResults;
    let protectedResponse;
    let invitationResponse = { data: [], error: null };
    let recommendationResponse = { data: [], error: null };
    let photoFiles = [];
    let documentFiles = [];
    try {
      [linkedResults, protectedResponse, photoFiles, documentFiles, invitationResponse, recommendationResponse] = await Promise.all([
        linkedRequests,
        canManageProtectedHr
          ? supabase.rpc("hr_employee_protected_summary", { p_employee_id: summary.id })
          : Promise.resolve({ data: null, error: null }),
        listOperationalFiles("employee_photo", summary.id),
        listOperationalFiles("employee_document", summary.id),
        supabase.rpc("admin_access_invitations"),
        summary.profile_id
          ? supabase.from("volunteer_change_recommendations")
              .select("id,recommendation_kind,requested_summary,reason,status,requested_at,requested_by,decided_at,decision_note,profiles!volunteer_change_recommendations_requested_by_fkey(full_name)")
              .eq("profile_id", summary.profile_id)
              .order("requested_at", { ascending: false })
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (generation !== personGeneration.current) return;
    } catch (fileError) {
      if (generation !== personGeneration.current) return;
      setProtectedHrLoading(false);
      setDetailLoading(false);
      setError(humanError(fileError, "That employee's private files could not load."));
      return;
    }

    [detailResult, employmentResult] = linkedResults;
    protectedResult = protectedResponse;
    const volunteerFeature = classifyPreviewFeatureResult("volunteerRecommendations", recommendationResponse);
    setProtectedHrLoading(false);
    setDetailLoading(false);

    if (detailResult.error || employmentResult.error || protectedResult.error || invitationResponse.error || volunteerFeature.error) {
      setError(humanError(detailResult.error || employmentResult.error || protectedResult.error || invitationResponse.error || volunteerFeature.error, "That employee record could not load."));
      return;
    }

    setProtectedHr(protectedResult.data || null);
    setVolunteerRecommendationsAvailable(volunteerFeature.available);
    setVolunteerRecommendations(Array.isArray(volunteerFeature.data) ? volunteerFeature.data : []);
    setEmployeeFiles({ photos: photoFiles, documents: documentFiles });

    let photoUrl = summary.photo_url || null;
    const latestPhoto = photoFiles[0] || null;
    if (latestPhoto) {
      try {
        photoUrl = await signedOperationalFileUrl(latestPhoto, 3600);
      } catch {
        photoUrl = summary.photo_url || null;
      }
    }

    if (generation !== personGeneration.current) return;
    const data = detailResult.data;
    const work = Array.isArray(data?.work) ? data.work.map((item) => ({
      ...item,
      projects: item.project_name ? { name: item.project_name } : null,
    })) : [];
    const sessions = Array.isArray(data?.sessions) ? data.sessions : [];
    const leave = Array.isArray(data?.leave) ? data.leave : [];
    const done = work.filter((item) => ["completed","self_certified"].includes(item.status));
    const rosterDetail = rosterDetailResult.data || {};
    const rosterEmployee = rosterDetail.employee || {};
    const rosterUnits = Array.isArray(rosterDetail.units) ? rosterDetail.units : summary.roster_units || [];
    const employeeEmail = String(rosterEmployee.account_email || summary.email || "").trim().toLowerCase();
    const accessInvitation = (Array.isArray(invitationResponse.data) ? invitationResponse.data : [])
      .find((invitation) => String(invitation.email || "").trim().toLowerCase() === employeeEmail) || null;

    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    setProtectedEditor(null);
    setPerson({
      ...summary,
      ...rosterEmployee,
      hr_contact_email: hrContactResult.data.hr_contact_email || null,
      hr_contact_phone: hrContactResult.data.hr_contact_phone || null,
      hr_started_on: hrContactResult.data.hr_started_on || null,
      id: summary.id,
      employee_id: summary.id,
      profile_id: summary.profile_id || rosterEmployee.profile_id || null,
      roster_units: rosterUnits,
      email: rosterEmployee.account_email || summary.email || null,
      phone: rosterEmployee.account_phone || summary.phone || null,
      photo_url: photoUrl,
      operational_data_available: Boolean(rosterDetail.operational_data_available),
      items: work,
      done,
      assigned: done.filter((item) => item.origin === "assigned"),
      self: done.filter((item) => item.origin === "self_created"),
      onTime: done.filter((item) => item.due_at && item.completed_at && new Date(item.completed_at) <= new Date(item.due_at)),
      openWork: work.filter((item) => !["completed","self_certified","cancelled"].includes(item.status)),
      sessions,
      leave,
      employment: employmentResult.data || { current: null, history: [] },
      access_invitation: accessInvitation,
      balance: {
        annual_taken: summary.annual_taken || 0,
        sick_taken: summary.sick_taken || 0,
        carryover_from_last_year: summary.carryover_from_last_year || 0,
      },
    });
    } catch (failure) {
      if (generation === personGeneration.current) {
        setDetailLoading(false);
        setProtectedHrLoading(false);
        setError(humanError(failure, "This employee's current record could not be verified. Try opening it again."));
      }
    }
  }

  function openAccessAdministration(profileId = null, inviteRoster = null) {
    personGeneration.current += 1;
    employeeFileWriteBusy.current = false;
    setEmployeeFileBusy(false);
    clearEditorsForNavigation();
    setDetailLoading(false);
    setProtectedHrLoading(false);
    setAccessFocusProfileId(profileId);
    setAccessFocusUnitId(null);
    setAccessFocusMode(profileId ? "responsibility" : "invite");
    setAccessInviteRoster(profileId ? null : inviteRoster);
    setPerson(null);
    setDrill(null);
    setViewMode("access");
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }

  async function refreshEmployeeFiles(employeeId, generation) {
    const [photos, documents] = await Promise.all([
      listOperationalFiles("employee_photo", employeeId),
      listOperationalFiles("employee_document", employeeId),
    ]);
    if (generation !== personGeneration.current) return;
    const latest = photos[0] || null;
    const photoUrl = latest ? await signedOperationalFileUrl(latest, 3600) : null;
    if (generation !== personGeneration.current) return;
    setEmployeeFiles({ photos, documents });
    setRows((current) => current.map((entry) => entry.id === employeeId ? { ...entry, photo_url: photoUrl } : entry));
    setPerson((current) => current?.id === employeeId ? { ...current, photo_url: photoUrl } : current);
  }

  async function uploadEmployeeFile(file, kind) {
    if (!person?.id || !file || employeeFileWriteBusy.current) return;
    const generation = personGeneration.current;
    employeeFileWriteBusy.current = true;
    setEmployeeFileBusy(true);
    setError(null);
    try {
      await uploadOperationalFile({
        file,
        contextType: kind === "photo" ? "employee_photo" : "employee_document",
        contextId: person.id,
        relation: kind === "photo" ? "employee_photo" : "employee_document",
      });
      await refreshEmployeeFiles(person.id, generation);
    } catch (fileError) {
      if (generation === personGeneration.current) {
        setError(humanError(fileError, kind === "photo"
          ? "The employee photo could not be confirmed. Review the record before trying again."
          : "The employee document could not be confirmed. Review the record before trying again."));
      }
    } finally {
      if (generation === personGeneration.current) {
        employeeFileWriteBusy.current = false;
        setEmployeeFileBusy(false);
      }
    }
  }

  async function saveProtectedRecord(form) {
    if (!person?.employee_id || !canManageProtectedHr || protectedWriteBusy.current) return;
    const employeeId = person.employee_id;
    const generation = personGeneration.current;
    protectedWriteBusy.current = true;
    setSavingProtected(true);
    setError(null);
    let recorded = false;
    try {
      const { error: saveError } = await supabase.rpc("hr_employee_protected_record", {
        p_employee_id: employeeId,
        p_record_type: form.recordType,
        p_payload: form.payload,
        p_replaces_id: form.replacesId || null,
        p_reason: form.reason,
      });
      if (saveError) throw saveError;
      recorded = true;
      if (generation !== personGeneration.current) return;
      const { data, error: refreshError } = await supabase.rpc("hr_employee_protected_summary", {
        p_employee_id: employeeId,
      });
      if (refreshError) throw refreshError;
      if (generation !== personGeneration.current) return;
      setProtectedHr(data || null);
      setProtectedEditor(null);
    } catch (failure) {
      if (generation === personGeneration.current) {
        setError(recorded
          ? "Protected HR data was recorded, but its latest state could not be verified. Review the record before submitting again."
          : humanError(failure, "Protected HR data could not be confirmed. Review before retrying."));
      }
    } finally {
      protectedWriteBusy.current = false;
      if (generation === personGeneration.current) setSavingProtected(false);
    }
  }

  function openEmploymentEditor() {
    if (!person) return;
    const current = person.employment?.current || {};
    setEmploymentForm({
      changeType: "employment_details_changed",
      effectiveOn: new Date().toISOString().slice(0, 10),
      employmentType: current.employment_type || person.contract_type || "not_recorded",
      jobTitle: current.job_title ?? person.job_title ?? "",
      unitId: current.unit_id || person.unit_id || "",
      managerId: current.manager_profile_id || "",
      role: current.membership_role || person.role || "staff",
      workingPattern: current.working_pattern?.kind || "not_recorded",
      status: current.employment_status || (person.active ? "active" : "inactive"),
      joinedOn: current.joined_on || person.started_on || "",
      exitedOn: current.exited_on || "",
      reason: "",
      correctionOf: "",
    });
    setEmploymentEditor(true);
  }

  async function decideVolunteerRecommendation(row, status) {
    if (!row?.id || !["accepted","declined"].includes(status)
        || recommendationWriteBusy.current || !volunteerRecommendationsAvailable) return;
    const generation = personGeneration.current;
    const visibleId = person?.employee_id;
    recommendationWriteBusy.current = true;
    setVolunteerDecisionBusy(true);
    setError(null);
    const note = status === "accepted"
      ? "Recommendation accepted for formal Administration follow-up. No employment or compensation value was changed automatically."
      : "Recommendation declined by Administration.";
    try {
      // Zero matching rows means another approver already acted; it is NOT a
      // successful decision from this administrator.
      const { data, error: decisionError } = await supabase.from("volunteer_change_recommendations")
        .update({ status, decided_by: me.id, decided_at: new Date().toISOString(), decision_note: note })
        .eq("id", row.id)
        .eq("status", "pending")
        .select("id,status,decided_at,decision_note")
        .maybeSingle();
      if (decisionError) throw decisionError;
      if (!data) throw new Error("This recommendation was already changed or is no longer available. Reload its record before trying again.");
      if (generation !== personGeneration.current) return;
      setVolunteerRecommendations((entries) => visibleId === person?.employee_id
        ? entries.map((entry) => entry.id === row.id ? { ...entry, ...data } : entry)
        : entries);
    } catch (failure) {
      if (generation === personGeneration.current)
        setError(humanError(failure, "The recommendation decision could not be confirmed. Reload the record before retrying."));
    } finally {
      recommendationWriteBusy.current = false;
      if (generation === personGeneration.current) setVolunteerDecisionBusy(false);
    }
  }

  async function saveEmployment() {
    if (!person?.profile_id || !employmentForm || employmentWriteBusy.current) return;
    const profileId = person.profile_id;
    const employeeId = person.employee_id;
    const generation = personGeneration.current;
    employmentWriteBusy.current = true;
    setSavingEmployment(true);
    setError(null);
    try {
      const { data, error: saveError } = await supabase.rpc("admin_update_employment", {
        p_profile_id: profileId,
        p_employment_type: employmentForm.employmentType,
        p_job_title: employmentForm.jobTitle || null,
        p_unit_id: employmentForm.unitId || null,
        p_manager_profile_id: employmentForm.managerId || null,
        p_membership_role: employmentForm.role,
        p_working_pattern: { kind: employmentForm.workingPattern || "not_recorded" },
        p_employment_status: employmentForm.status,
        p_joined_on: employmentForm.joinedOn || null,
        p_exited_on: employmentForm.status === "exited" ? (employmentForm.exitedOn || null) : null,
        p_change_type: employmentForm.changeType,
        p_effective_on: employmentForm.effectiveOn,
        p_reason: employmentForm.reason || null,
        p_correction_of: employmentForm.changeType === "correction" ? (employmentForm.correctionOf || null) : null,
      });
      if (saveError) throw saveError;
      if (generation !== personGeneration.current) return;
      const current = data?.current;
      if (!current) {
        setError("The employment update response could not be verified. Reopen the record before retrying.");
        return;
      }
      setPerson((value) => value?.employee_id === employeeId ? ({
        ...value,
        employment: data,
        unit_id: current.unit_id,
        unit_name: current.unit_name,
        role: current.membership_role,
        job_title: current.job_title,
        employment_type: current.employment_type,
        contract_type: current.employment_type,
        started_on: current.joined_on,
        active: current.employment_status === "active",
      }) : value);
      setEmploymentEditor(false);
      setEmploymentForm(null);
      await load();
    } catch (failure) {
      if (generation === personGeneration.current) {
        setError(humanError(failure, "The employment change could not be confirmed. Check current employment history before retrying."));
      }
    } finally {
      employmentWriteBusy.current = false;
      if (generation === personGeneration.current) setSavingEmployment(false);
    }
  }

  const cleanSearch = searchText.trim().toLowerCase();
  const shown = rows.filter((p) => {
    const matchesFilter =
      filter === "all" ? true :
      filter === "active" ? p.active :
      filter === "on_leave" ? p.on_leave_now :
      filter === "quiet" ? p.quiet :
      filter === "no_unit" ? !p.unit_id : true;
    const matchesSearch = !cleanSearch || [
      p.full_name,p.source_display_name,p.email,p.job_title,p.source_position,p.source_department_text,p.unit_name,
      ...(p.roster_units || []).map((unit) => unit.unit_name),
      ...(p.responsibility_context || []),
    ].filter(Boolean).some((value) => String(value).toLowerCase().includes(cleanSearch));
    return matchesFilter && matchesSearch && (!departmentFilter || p.unit_id === departmentFilter || (p.roster_units || []).some(unit => unit.unit_id === departmentFilter));
  });

  function rank(p) {
    if (!p.profile_id) return 4;
    if (p.is_exec) return 0;
    if (p.is_admin) return 1;
    if (p.role === "manager") return 2;
    if (p.role === "sub_team_lead") return 3;
    return 4;
  }
  function rankLabel(p) {
    if (!p.profile_id) return p.source_position || "Roster employee";
    if (p.is_exec) return "Group Pastor";
    if (p.is_admin) return "Administration & HR";
    if (p.role === "manager") return "Unit head";
    if (p.role === "sub_team_lead") return "Team lead";
    return "Staff";
  }

  const byUnit = {};
  shown.forEach((p) => {
    const key = p.unit_name || "No unit yet";
    (byUnit[key] = byUnit[key] || []).push(p);
  });
  const groups = Object.keys(byUnit)
    .sort((a, b) => (a === "No unit yet" ? 1 : b === "No unit yet" ? -1 : a.localeCompare(b)))
    .map((name) => ({
      name,
      people: byUnit[name].sort((a, b) =>
        rank(a) - rank(b)
        || String(a.started_on || "9999").localeCompare(String(b.started_on || "9999"))
        || a.full_name.localeCompare(b.full_name)),
    }));
  const roster = groups.flatMap((group) => group.people);
  const attentionReasons = (entry) => [
    entry.identity_state === "needs_review" ? "Identity review required" : null,
    entry.employment_type === "not_recorded" ? "Employment type not recorded" : null,
    !(entry.job_title || entry.source_position) ? "Job title not recorded" : null,
    !entry.unit_id && !(entry.roster_units || []).length ? "No unit recorded" : null,
  ].filter(Boolean);
  const attentionRoster = rows.filter((entry) => attentionReasons(entry).length);
  const unlinkedAccounts=operationalDirectory.filter(account=>account.active && !rows.some(entry=>entry.profile_id===account.id));
  const unmatchedAccounts=unlinkedAccounts;
  const unitsWithoutHead = units.filter((unit) => !(unit.unit_memberships || []).some(member=>member.role === "manager" && member.profiles?.active) && !operationalDirectory.some(account=>account.active && account.role === "manager" && account.unit_id === unit.id) && !rows.some((entry) =>
    entry.profile_id && entry.active && entry.role === "manager" && (
      entry.unit_id === unit.id || (entry.roster_units || []).some((membership) => membership.unit_id === unit.id)
    )
  ));


  function leaveEmployeeRecord() {
    personGeneration.current += 1;
    employeeFileWriteBusy.current = false;
    setEmployeeFileBusy(false);
    clearEditorsForNavigation();
    setPerson(null); setDrill(null); setDetailLoading(false);
    setProtectedHr(null); setProtectedHrLoading(false);
  }

  function renderPeoplePage(content) {
    const directory = viewMode === "directory";
    return <div className="body ev2-people-page ev2-people-admin pp-split-page">
      <PeoplePageHeader title="People & Access" description="Employee records and account access"
        actionLabel="Add employee" onAction={()=>setCreatingEmployee(true)} />
    {creatingEmployee && <HRCreateRosterEmployee
      me={me} units={units} employees={rows} accounts={operationalDirectory}
      onClose={()=>setCreatingEmployee(false)}
      onCreated={async employee=>{
        if(!(await load({silent:true})))throw new Error("The employee was created but the directory did not refresh. Recheck existing employees before retrying.");
        setCreatingEmployee(false);
        setSearchText("");
        setFilter("all");
        setViewMode("directory");
        await openPerson({
          id:employee.id,employee_id:employee.id,profile_id:null,
          full_name:employee.full_name,employment_status:employee.employment_status,
          job_title:employee.job_title,identity_state:"roster_only",active:employee.employment_status==="active",
        });
      }}
    />}

      <div className="ev2p-filter-tabs pp-page-tabs" role="tablist" aria-label="People views">
        {PEOPLE_VIEWS.map(([key,label])=><button key={key} type="button" role="tab"
          aria-selected={viewMode===key} className={viewMode===key?"ev2p-filter-tab is-selected":"ev2p-filter-tab"}
          onClick={()=>{leaveEmployeeRecord(); if(key!=="access"){setAccessFocusProfileId(null);setAccessFocusUnitId(null);setAccessFocusMode(null);}setViewMode(key);}}>{person && key === "access" ? "Access administration" : label}</button>)}
      </div>
      {!leavePolicy && <ProductNotice tone="attention" title="Leave policy not configured">Leave entitlement remains unavailable until Administration confirms the policy.</ProductNotice>}
      <div className={directory ? `pp-split-workspace ${person || detailLoading ? "has-selection" : ""}` : "pp-secondary-view"}>
        {directory && <aside className="pp-directory-rail" aria-label="Employee directory">
          <div className="pp-directory-controls">
            <h2>Employees <span>{shown.length}</span></h2>
            <label>Find a person<input className="field" type="search" placeholder="Name, email, job title or unit" value={searchText} onChange={event=>setSearchText(event.target.value)} /></label>
            <label>Department<select className="field" value={departmentFilter} onChange={event=>setDepartmentFilter(event.target.value)}>
              <option value="">All departments</option>{units.map(unit=><option key={unit.id} value={unit.id}>{unit.name}</option>)}
            </select></label>
            <label>Show<select aria-label="Show" className="field" value={filter} onChange={event=>setFilter(event.target.value)}>{FILTERS.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
          </div>
          <div className="pp-directory-list">
            {shown.map(entry=><button type="button" className={`pp-directory-row fpg-people-roster-row ${person?.id===entry.id?"is-selected":""}`} key={entry.id} aria-pressed={person?.id===entry.id} onClick={()=>openPerson(entry)}>
              <Avatar name={entry.full_name} src={entry.photo_url} size="md" />
              <span className="pp-directory-copy"><strong>{entry.full_name}</strong><span>{entry.job_title || entry.source_position || rankLabel(entry)}</span><small>{entry.unit_name || "No unit assigned"}</small></span>
              <span className="pp-directory-state">{entry.on_leave_now?"On leave":entry.active?"Active":"Inactive"}<br/>{entry.identity_state==="needs_review"?"Identity review":entry.profile_id?"Account linked":"Roster only"}</span>
            </button>)}
            {!shown.length && <PeopleEmpty title="Nobody matches" description="Try a different filter or search term." />}
          </div>
          <button type="button" className="pp-review-link" onClick={()=>{leaveEmployeeRecord();setViewMode("attention");}}>Needs attention · {attentionRoster.length + unlinkedAccounts.length} to review</button>
        </aside>}
        <section className="pp-detail-pane" aria-label={directory?"Selected employee record":"People administration"} aria-busy={detailLoading}>
          {detailLoading ? <LoadingState label="Opening employee record…" /> : content}
          {!person && error && <ProductNotice tone="error" title="People could not finish loading" action={<button className="btn btn-ghost btn-sm" onClick={load}>Try again</button>}>{error}</ProductNotice>}
        </section>
      </div>
    </div>;
  }

  if (loading) return <div className="body"><LoadingState label="Loading People…" /></div>;
  if (verifiedRosterScope !== scopeKey) return <div className="body">
    <ProductNotice tone="error" title="People records unavailable">{error || "The authorised People directory could not be verified."}</ProductNotice>
    <Button onClick={() => void load()}>Retry People records</Button>
  </div>;

  if (person && drill) {
    return renderPeoplePage(<div className="ev2-person-workspace ev2-admin-person-workspace">
      <PeopleBackButton onClick={() => setDrill(null)} label={person.full_name} />
      <PeoplePersonHeader
        name={drill.label}
        eyebrow="Employee record"
        subtitle={person.full_name}
        context="Factual employee evidence only."
      />
      <PeopleWorkspaceSection
        title={drill.label}
        description="Authorised factual records connected to this employee."
        meta={`${drill.rows.length} recorded`}
      >
        {drill.rows.length === 0 && <PeopleEmpty title="Nothing recorded here yet" description="There is no authorised record in this group." />}
        {drill.kind === "work" && drill.rows.map((item) => <button key={item.id} className="ev2p-link-row" onClick={() => openItem(item.id)}>
          <span className="ev2p-link-row-main">
            <strong>{item.title}</strong>
            <span>{item.ref} · {item.completed_at ? "finished " + dateOnly(item.completed_at) : dueLabel(item.due_at)}{item.projects ? " · " + item.projects.name : ""}</span>
          </span>
          <span className="ev2p-link-row-tail">{statusPill(item.status)}</span>
        </button>)}
        {drill.kind === "sessions" && drill.rows.map((session) => <PeopleFactRow
          key={session.id}
          icon="time"
          title={new Date(session.started_at).toLocaleDateString("en-GB", { timeZone: "Africa/Accra", weekday: "short", day: "numeric", month: "short" })}
          subtitle={`Started ${new Date(session.started_at).toLocaleTimeString("en-GB", { timeZone: "Africa/Accra", hour: "2-digit", minute: "2-digit" })}${session.ended_at ? " · ended " + new Date(session.ended_at).toLocaleTimeString("en-GB", { timeZone: "Africa/Accra", hour: "2-digit", minute: "2-digit" }) : " · still open"}${session.place === "office" ? " · at the office" : " · elsewhere"}`}
        />)}
        {drill.kind === "leave" && drill.rows.map((request) => <PeopleFactRow
          key={request.id}
          icon="calendar"
          title={`${request.days} day${request.days === 1 ? "" : "s"} ${request.kind}`}
          subtitle={`${dateOnly(request.start_date)} — ${dateOnly(request.end_date)}`}
          meta={request.status}
        />)}
      </PeopleWorkspaceSection>
    </div>);
  }

  if (person) {
    const hasLinkedProfile = Boolean(person.profile_id);
    const employmentCurrent = person.employment?.current || null;
    const employmentHistory = Array.isArray(person.employment?.history) ? person.employment.history : [];
    const taken = Number(person.balance?.annual_taken || 0);
    const entitlement = leavePolicy ? Number(leavePolicy.annual_days || 0) : null;
    const employmentState = (employmentCurrent?.employment_status || person.employment_status || (person.active ? "active" : "inactive")).replaceAll("_", " ");
    const rosterUnitNames = (person.roster_units || []).map((unit) => unit.unit_name).filter(Boolean);
    const rosterManagerName = person.manager_profile_id
      ? operationalDirectory.find((entry) => entry.id === person.manager_profile_id)?.full_name || "Manager identity unavailable"
      : "Not recorded";
    const positionLabel = hasLinkedProfile
      ? (person.is_exec ? "Group Pastor" : person.is_admin ? "Administration & HR" : person.role === "manager" ? "Unit head" : person.role === "sub_team_lead" ? "Team lead" : "Staff")
      : (person.job_title || person.source_position || "Roster employee");
    const identityLabel = person.identity_state === "needs_review"
      ? "Identity review required"
      : hasLinkedProfile ? "Account linked" : "Roster only · no account linked";
    const accessInvitation = person.access_invitation || null;
    const accessState = !hasLinkedProfile
      ? "No login identity linked"
      : person.active ? "Active operational access" : "Operational access inactive";
    const invitationState = accessInvitation
      ? accessInvitation.revoked_at
        ? "Invitation cancelled"
        : accessInvitation.activation_state === "verified"
          ? "Email verified"
          : accessInvitation.activation_state === "expired"
            ? "Invitation expired"
            : "Awaiting email verification"
      : hasLinkedProfile ? "No pending invitation" : "No invitation recorded";
    const responsibilitySummary = rosterUnitNames.length
      ? rosterUnitNames.join(" · ")
      : "No organisational responsibility recorded";
    function editSelectedEmployment(changeType="employment_details_changed") {
      setPersonTab("employment");
      if (hasLinkedProfile) {
        openEmploymentEditor();
        if (changeType==="transferred") setEmploymentForm(form=>({...form,changeType:"transferred"}));
      } else {
        setRosterEditRequest(request=>({
          employeeId:person.employee_id, seq:request.seq+1,
        }));
      }
    }

    return renderPeoplePage(<div className="ev2-person-workspace ev2-admin-person-workspace">
      <PeopleBackButton onClick={() => { personGeneration.current += 1; employeeFileWriteBusy.current = false; setEmployeeFileBusy(false); setPerson(null); setDrill(null); }} label="All people" ariaLabel="← All people" />

      <div className="pp-record-layout">
        <div className="pp-record-identity" aria-label="Employee context">
      <header className="pp-profile-heading">
        <Avatar name={person.full_name} src={person.photo_url} size="lg" />
        <div><h2>{person.full_name}</h2>
          <p>{employmentCurrent?.job_title || person.job_title || person.source_position || "No job title recorded"}</p>
          <small>{employmentCurrent?.unit_name || person.unit_name || "No unit recorded"} · {hasLinkedProfile ? (employmentCurrent?.manager_name ? `Reports to ${employmentCurrent.manager_name}` : positionLabel) : rosterManagerName}</small>
        </div>
        <div className="pp-record-status" aria-label="Employment and account status">
          <span>Employment: <strong>{employmentState}</strong></span>
          <span>Account: <strong>{hasLinkedProfile ? "Linked" : "Not linked"}</strong></span>
        </div>
      </header>
      <details className="pp-photo-editor"><summary>Change employee photo</summary>
      <FieldGroup label="Employee photo">
        <input
          className="field"
          aria-label="Employee photo"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={employeeFileBusy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) uploadEmployeeFile(file, "photo");
          }}
        />
      </FieldGroup>
      <p className="screen-note">Stored privately in CEAC. Initials remain the fallback when no photo is recorded.</p></details>

      {error && <ProductNotice tone="error" title="Employee record">{error}</ProductNotice>}
      {!volunteerRecommendationsAvailable && <ProductNotice tone="attention" title="Volunteer recommendations pending">
        This feature is not yet installed in the approved database. The employee record is available; recommendation history and decisions remain unavailable until the Phase 6 migration passes release verification.
      </ProductNotice>}
      {!hasLinkedProfile && (person.hr_contact_email || person.hr_contact_phone || person.hr_started_on) &&
        <div className="ev2p-admin-record-grid" aria-label="HR contact and start date">
          {person.hr_contact_email && <PeopleFactRow icon="info" title="HR contact email (not login)" subtitle={person.hr_contact_email} />}
          {person.hr_contact_phone && <PeopleFactRow icon="info" title="HR contact telephone" subtitle={person.hr_contact_phone} />}
          {person.hr_started_on && <PeopleFactRow icon="calendar" title="Employment start date" subtitle={dateOnly(person.hr_started_on)} />}
        </div>}
      {person.on_leave_now && <ProductNotice tone="attention" title="On approved leave">This employee is currently away on approved leave.</ProductNotice>}
      {!person.active && <ProductNotice tone="error" title="Inactive employee">This employee is marked inactive and cannot sign in.</ProductNotice>}



        </div>

        <div className="ev2p-admin-person-detail">
        <div className="workforce-setup-actions ev2p-admin-person-primary-actions" role="group" aria-label="Employee record actions" style={{display:"flex",flexWrap:"wrap",alignItems:"center",gap:8,marginBottom:16,minWidth:0}}>
          <button type="button" className="btn" onClick={()=>editSelectedEmployment()}>Edit employee record</button>
          <button type="button" className="btn btn-ghost" onClick={()=>editSelectedEmployment("transferred")}>Assign / transfer department</button>
          <button type="button" className="btn btn-ghost" onClick={()=>setPersonTab("time")}>Work schedule</button>
          <button type="button" className="btn btn-ghost" onClick={()=>setPersonTab("documents")}>Documents</button>
          {!hasLinkedProfile&&<button type="button" className="btn btn-ghost" onClick={()=>openAccessAdministration(null,{
            employeeId:person.employee_id,
            requestedBy:me.id,
            orgId:me.org_id,
            name:person.full_name,
            contactEmail:person.hr_contact_email || "",
            unitId:(person.roster_units||[]).find(member=>member.is_primary)?.unit_id||"",
          })}>Invite account</button>}
          {hasLinkedProfile&&<button type="button" className="btn btn-ghost" onClick={()=>setPersonTab("access")}>Account & permissions</button>}
        </div>
        <div className="ev2p-filter-tabs" role="tablist" aria-label="Employee record sections">
          {[...PERSON_TABS, ...(canManageProtectedHr ? [["protected","Protected HR"]] : [])].map(([key, label]) => <button
            key={key}
            type="button"
            role="tab"
            aria-selected={personTab === key}
            className={personTab === key ? "ev2p-filter-tab is-selected" : "ev2p-filter-tab"}
            onClick={() => setPersonTab(key)}
          >{label}</button>)}
        </div>

        {personTab === "overview" && <PeopleWorkspaceSection title="Overview">
          <div className="pp-overview-columns">
            <div><h3>Employment details</h3><dl className="pp-key-values">
              <div><dt>Current title</dt><dd>{employmentCurrent?.job_title || person.job_title || person.source_position || "Not recorded"}</dd></div>
              <div><dt>Employment type</dt><dd>{employmentCurrent?.employment_type || person.employment_type || person.contract_type || "Not recorded"}</dd></div>
              <div><dt>Start date</dt><dd>{employmentCurrent?.joined_on || person.hr_started_on ? dateOnly(employmentCurrent?.joined_on || person.hr_started_on) : "Not recorded"}</dd></div>
              <div><dt>Employment status</dt><dd>{employmentState}</dd></div>
            </dl></div>
            <div><h3>Reporting & placement</h3><dl className="pp-key-values">
              <div><dt>Primary unit</dt><dd>{employmentCurrent?.unit_name || person.unit_name || "Not recorded"}</dd></div>
              <div><dt>Manager</dt><dd>{hasLinkedProfile ? (employmentCurrent?.manager_name || "Not recorded") : rosterManagerName}</dd></div>
              <div><dt>Recorded units</dt><dd>{rosterUnitNames.join(" · ") || "Not recorded"}</dd></div>
              <div><dt>Account</dt><dd>{person.email || identityLabel}</dd></div>
            </dl></div>
          </div>
          <div className="pp-account-context"><span>Employee records exist independently of login access.</span>
            <button type="button" onClick={()=>setPersonTab("access")}>Review account access →</button>
          </div>
          <div className="pp-recent-history"><h3>Recent record changes</h3>
            {employmentHistory.length ? employmentHistory.slice(0,3).map((entry,index)=><div key={entry.id || index}>
              <strong>{employmentChangeLabel(entry.change_type || entry.event_type || "Employment record")}</strong>
              <span>{entry.effective_on ? dateOnly(entry.effective_on) : "Date not recorded"}</span>
            </div>) : <p>No linked employment snapshots are available here. Open History or Employment for the existing record and change history.</p>}
            <button type="button" onClick={()=>setPersonTab("history")}>View history →</button>
          </div>
        </PeopleWorkspaceSection>}
      {personTab === "access" && <PeopleWorkspaceSection
        title="Access & responsibilities"
        description="Account access, organisational placement and authority remain separate from job title and employment facts."
        meta={<div className="phase5-person-access-actions">
          {person.profile_id && onManagePermissions && <button type="button" className="ev2p-admin-record-change" onClick={()=>onManagePermissions(person.profile_id)}>Manage permissions</button>}
          <Button
            variant="secondary"
            size="compact"
            onClick={() => openAccessAdministration(person.profile_id || null)}
          >{person.profile_id ? "Manage responsibilities" : "Invite account"}</Button>
          <Button
            variant="quiet"
            size="compact"
            disabled={!person.profile_id}
            onClick={() => openLifecycle?.(person.profile_id, "offboarding")}
          >Offboard / deactivate access</Button>
        </div>}
      >
        <div className="ev2p-admin-record-grid">
          <PeopleFactRow icon="people" title="Login identity" subtitle={identityLabel} />
          <PeopleFactRow icon="info" title="Access state" subtitle={accessState} />
          <PeopleFactRow icon="notification" title="Invitation" subtitle={invitationState} />
          <PeopleFactRow icon="people" title="Primary unit" subtitle={employmentCurrent?.unit_name || person.unit_name || "Not recorded"} />
          <PeopleFactRow icon="people" title="Manager" subtitle={hasLinkedProfile ? (employmentCurrent?.manager_name || "Not recorded") : rosterManagerName} />
          <PeopleFactRow icon="people" title="Application role" subtitle={hasLinkedProfile ? (employmentCurrent?.membership_role || person.role || "staff").replaceAll("_", " ") : "Not inferred from job title"} />
          <PeopleFactRow icon="organisation" title="Recorded responsibilities" subtitle={responsibilitySummary} />
          <PeopleFactRow icon="info" title="Employee status" subtitle={employmentState} />
        </div>
        {accessInvitation ? <div className="phase5-person-invitation">
          <div>
            <strong>{accessInvitation.email}</strong>
            <span>Invited {new Date(accessInvitation.invited_at).toLocaleString("en-GB", { timeZone: "Africa/Accra" })} · {invitationState}</span>
          </div>
          <Button variant="quiet" size="compact" onClick={() => openAccessAdministration(person.profile_id || null)}>Review invitation</Button>
        </div> : null}
        {!person.profile_id && <RosterAccountLink
          key={`${me.org_id}:${me.id}:${person.employee_id}`}
          me={me} employee={person} documents={employeeFiles.documents}
          onLinked={()=>{personGeneration.current+=1;setPerson(null);setDrill(null);void load();}}
        />}
        <p className="phase5-person-access-note">
          Job title never grants application authority. Additional unit or team responsibility is recorded against the existing identity; access deactivation and offboarding use the controlled lifecycle workflow.
        </p>
      </PeopleWorkspaceSection>}

      {personTab === "employment" && <>
      <PeopleWorkspaceSection
        title="Employment record"
        description="The current authorised employment record. Recording a change creates a new historical snapshot rather than overwriting the past."
        meta={hasLinkedProfile ? <button type="button" className="ev2p-admin-record-change" onClick={openEmploymentEditor}>Record change</button> : <button type="button" className="ev2p-admin-record-change" onClick={()=>document.getElementById("roster-employee-editor")?.scrollIntoView({behavior:"smooth",block:"center"})}>Edit roster record below</button>}
      >
        <div className="ev2p-admin-record-grid">
          <PeopleFactRow icon="people" title="Employment type" subtitle={employmentCurrent?.employment_type || person.employment_type || person.contract_type || "Not recorded"} />
          <PeopleFactRow icon="work" title={hasLinkedProfile ? "Title" : "Source position"} subtitle={employmentCurrent?.job_title || person.job_title || person.source_position || "Not recorded"} />
          <PeopleFactRow icon="people" title={hasLinkedProfile ? "Primary unit" : "Recorded units"} subtitle={employmentCurrent?.unit_name || (rosterUnitNames.length ? rosterUnitNames.join(" · ") : "Not recorded")} />
          <PeopleFactRow icon="people" title="Manager" subtitle={hasLinkedProfile ? (employmentCurrent?.manager_name || "Not recorded") : rosterManagerName} />
          <PeopleFactRow icon="people" title="Role / authority" subtitle={hasLinkedProfile ? (employmentCurrent?.membership_role || person.role || "staff").replaceAll("_", " ") : "Not inferred from workbook title"} />
          <PeopleFactRow icon="calendar" title="Working pattern" subtitle={hasLinkedProfile ? (employmentCurrent?.working_pattern?.kind || "not recorded").replaceAll("_", " ") : "Not recorded"} />
          <PeopleFactRow icon="calendar" title={hasLinkedProfile ? "Joined" : "Recorded start date"} subtitle={hasLinkedProfile ? (employmentCurrent?.joined_on ? dateOnly(employmentCurrent.joined_on) : "Not recorded") : (person.hr_started_on ? dateOnly(person.hr_started_on) : "See verified HR record below")} />
          <PeopleFactRow icon="info" title="Employment status" subtitle={employmentState} />
          {employmentCurrent?.exited_on && <PeopleFactRow icon="calendar" title="Exit date" subtitle={dateOnly(employmentCurrent.exited_on)} />}
        </div>
      </PeopleWorkspaceSection>

      {hasLinkedProfile && <LinkedEmployeeContactEditor
        key={`${me.org_id}:${me.id}:${person.profile_id}`} me={me} employeeId={person.employee_id} profileId={person.profile_id}
        onSaved={(details)=>{
          setPerson(current=>current?.profile_id===details.id?{...current,...details}:current);
          void load({silent:true});
        }}
      />}

      {!hasLinkedProfile && <div id="roster-employee-editor"><RosterOnlyEmploymentEditor
        me={me} employeeId={person.employee_id} units={units}
        editRequest={rosterEditRequest.employeeId===person.employee_id?rosterEditRequest.seq:0}
        onSaved={(updated)=>{
          setPerson(current=>current?.employee_id===updated.employee_id?{...current,...updated,active:updated.employment_status==="active"}:current);
          void load({silent:true});
        }} />
      </div>}

      {(employmentCurrent?.employment_type === "volunteer" || person.employment_type === "volunteer") && <PeopleWorkspaceSection
        title="Manager recommendations"
        description="Managers may recommend a formal volunteer status, engagement or compensation change. Acceptance here does not perform the formal change; Administration must use the employment or protected-HR record."
        meta={`${volunteerRecommendations.filter((row) => row.status === "pending").length} pending`}
      >
        {volunteerRecommendations.length ? <div className="phase6-admin-volunteer-recommendations">
          {volunteerRecommendations.map((row) => <article key={row.id}>
            <div>
              <strong>{row.requested_summary}</strong>
              <span>{String(row.recommendation_kind || "").replaceAll("_"," ")} · {row.profiles?.full_name || "Manager"} · {dateOnly(row.requested_at)}</span>
              <p>{row.reason}</p>
              {row.decision_note ? <small>{row.decision_note}</small> : null}
            </div>
            <div className="phase6-admin-volunteer-decision">
              <span className={`phase6-recommendation-status is-${row.status}`}>{row.status}</span>
              {row.status === "pending" && <>
                <Button variant="secondary" size="compact" disabled={volunteerDecisionBusy} onClick={() => decideVolunteerRecommendation(row,"declined")}>Decline</Button>
                <Button size="compact" disabled={volunteerDecisionBusy} onClick={() => decideVolunteerRecommendation(row,"accepted")}>Accept for formal follow-up</Button>
              </>}
            </div>
          </article>)}
        </div> : <PeopleEmpty title="No Manager recommendations" description="Formal volunteer changes remain with Administration. Manager recommendations will appear here when recorded." />}
      </PeopleWorkspaceSection>}
      </>}

      {personTab === "history" && <>
      <PeopleWorkspaceSection
        title="Employment history"
        description={hasLinkedProfile ? "Audited employment snapshots in effective-date order." : "A roster-only employee has no linked account employment history yet."}
        meta={hasLinkedProfile ? `${employmentHistory.length} recorded` : "Not linked"}
      >
        {!hasLinkedProfile
          ? <PeopleEmpty title="No linked employment history" description="The employee remains fully represented in the roster. Account and employment-history linking can happen later without recreating this employee." />
          : employmentHistory.length === 0
            ? <PeopleEmpty title="No employment history yet" description="Employment changes recorded here will preserve their effective date, reason and audit context." />
            : <div className="ev2p-admin-history-list">{employmentHistory.slice(0, 12).map((event) => <article className="ev2p-admin-history-row" key={event.id}>
                <div>
                  <strong>{employmentChangeLabel(event.change_type)}</strong>
                  <span>
                    Effective {dateOnly(event.effective_on)}
                    {event.job_title ? " · " + event.job_title : ""}
                    {event.unit_name ? " · " + event.unit_name : ""}
                  </span>
                  {event.reason && <small>{event.reason}</small>}
                </div>
                <span>{event.actor_name ? `Recorded by ${event.actor_name}` : "System baseline"}</span>
              </article>)}</div>}
      </PeopleWorkspaceSection>
      </>}

      {personTab === "work" && <>
      <PeopleWorkspaceSection
        title="Work & activity context"
        description={hasLinkedProfile
          ? "Factual authorised work evidence only. These records are not a productivity score, ranking, pay input or disciplinary conclusion."
          : "Operational work evidence appears only when this employee is linked to a real CEAC account."}
      >
        {!hasLinkedProfile && <PeopleEmpty title="No linked operational account" description="The employee is present in the roster, but CEAC will not invent work, attendance or submission records for someone without a linked account." />}
        {hasLinkedProfile && <>
        <div className="ev2p-outcome-grid ev2p-admin-work-grid">
          <button type="button" onClick={() => setDrill({ label: "Finished work — given to them", kind: "work", rows: person.assigned })}>
            <b>{person.assigned.length}</b><span>finished — given to them</span>
          </button>
          <button type="button" onClick={() => setDrill({ label: "Finished work — added themselves", kind: "work", rows: person.self })}>
            <b>{person.self.length}</b><span>finished — added themselves</span>
          </button>
          <button type="button" onClick={() => setDrill({ label: "Completed on time", kind: "work", rows: person.onTime })}>
            <b>{person.onTime.length}</b><span>completed on time</span>
          </button>
          <button type="button" onClick={() => setDrill({ label: "Completed outcomes", kind: "work", rows: person.done })}>
            <b>{person.done.length}</b><span>completed outcomes</span>
          </button>
        </div>

        <button type="button" className="ev2p-link-row ev2p-admin-open-work" onClick={() => setDrill({ label: "Open work", kind: "work", rows: person.openWork })}>
          <span className="ev2p-link-row-main">
            <strong>{person.openWork.length} open job{person.openWork.length === 1 ? "" : "s"}</strong>
            <span>Open the authorised current work record.</span>
          </span>
          <span className="ev2p-link-row-tail">›</span>
        </button>

        </>}
      </PeopleWorkspaceSection>
      </>}

      {personTab === "time" && <>
      <PeopleWorkspaceSection
        title="Time & Leave"
        description={hasLinkedProfile
          ? (leavePolicy ? "Recorded work-session and leave context against the currently configured leave policy. No work session is not an absence." : "Recorded work-session and leave context is shown, but entitlement is not calculated because Administration has not configured the policy. No work session is not an absence.")
          : "Time and leave history appears only when this employee is linked to an operational CEAC account."}
      >
        {!hasLinkedProfile && <PeopleEmpty title="No linked time or leave record" description="A real roster record can receive its HR-confirmed work schedule before an account is activated. Attendance and leave remain unavailable until a genuine profile is linked." />}
        <EmployeeScheduleEditor me={me} profileId={person.profile_id} employeeId={person.employee_id} unitId={person.unit_id} name={person.full_name} />
        {hasLinkedProfile && <>
        <PeopleEvidenceSummary
          facts={[
            { value: person.days_this_month || 0, label: "days with a recorded session this month" },
            { value: avgStartLabel(person.avg_start_minutes), label: "average recorded start" },
          ]}
          note="Work-session context describes recorded activity only. It does not measure productivity or determine pay."
        />
        <button type="button" className="ev2p-link-row ev2p-admin-session-link" onClick={() => setDrill({ label: "Recorded work sessions", kind: "sessions", rows: person.sessions })}>
          <span className="ev2p-link-row-main">
            <strong>{person.sessions.length} session record{person.sessions.length === 1 ? "" : "s"}</strong>
            <span>Inspect the underlying factual session records.</span>
          </span>
          <span className="ev2p-link-row-tail">›</span>
        </button>

        <div className="ev2p-admin-leave-card">
          {leavePolicy
            ? <ProgressMeter value={taken} max={entitlement} label="Recorded annual leave taken" detail={taken + " recorded · annual policy entitlement " + entitlement + " days; not an accrued or available balance"} />
            : <PeopleFactRow icon="calendar" title="Annual leave taken" subtitle={taken + " days recorded · active annual policy not configured"} />}
          <PeopleFactRow icon="calendar" title="Sick leave taken" subtitle={Number(person.balance?.sick_taken || 0) + " days recorded"} />
        </div>
        <button type="button" className="ev2p-link-row ev2p-admin-leave-link" onClick={() => setDrill({ label: "Leave history", kind: "leave", rows: person.leave })}>
          <span className="ev2p-link-row-main">
            <strong>{person.leave.length} request{person.leave.length === 1 ? "" : "s"} on record</strong>
            <span>Open the authorised leave history.</span>
          </span>
          <span className="ev2p-link-row-tail">›</span>
        </button>
        </>}
      </PeopleWorkspaceSection>
      <EmployeeAttendanceObservations key={`${me.org_id}:${me.id}:${person.employee_id}`}
        me={me} employeeId={person.employee_id} />
      </>}

      {["development","learning","equipment"].includes(personTab) && <EmployeeDossierRecords
        key={`${me.org_id}:${me.id}:${person.employee_id}:${person.profile_id || "unlinked"}`}
        me={me} employeeId={person.employee_id} profileId={person.profile_id}
        section={personTab}
      />}

      {personTab === "documents" && <PeopleWorkspaceSection
        title="Documents"
        description="Ordinary employee files use CEAC's private operational file domain. Protected HR documents remain behind the protected-HR boundary."
      >
        <FieldGroup label="Add employee document">
          <input
            className="field"
            aria-label="Add employee document"
            type="file"
            accept={OPERATIONAL_FILE_ACCEPT}
            disabled={employeeFileBusy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) uploadEmployeeFile(file, "document");
            }}
          />
        </FieldGroup>
        {employeeFiles.documents.length ? <div className="ev2p-link-list">
          {employeeFiles.documents.map((file) => <button
            type="button"
            className="ev2p-link-row"
            key={file.id}
            onClick={async () => {
              try {
                await openOperationalFile(file);
              } catch (fileError) {
                setError(humanError(fileError, "That employee document could not be opened."));
              }
            }}
          >
            <span className="ev2p-link-row-main">
              <strong>{file.filename}</strong>
              <span>{file.mime_type || "Private file"} · added {dateOnly(file.linked_at || file.created_at)}</span>
            </span>
            <span className="ev2p-link-row-tail">Open</span>
          </button>)}
        </div> : <PeopleEmpty title="No ordinary employee documents recorded" description="CEAC will not expose protected HR documents here or invent missing employee files." />}
        <p className="screen-note">Protected HR contracts, identifiers, payment details and protected documents do not appear in this ordinary Documents tab.</p>
      </PeopleWorkspaceSection>}

      {personTab === "protected" && <>
      <PeopleWorkspaceSection
        title="Protected HR"
        description="Salary, identifiers, payment details and documents stay behind the protected-HR capability boundary. Roster-only employees can hold these records without a login account."
        className="ev2p-admin-protected-section"
      >
        {protectedHrLoading && <LoadingState label="Loading protected HR…" />}
        {!canManageProtectedHr && <PeopleEmpty title="Protected HR unavailable" description="Your account does not hold protected-HR access." />}
        {canManageProtectedHr && !protectedHrLoading && (() => {
          const compensation = (protectedHr?.compensation || []).find((row) => row.status === "active") || null;
          const payment = (protectedHr?.payment_details || []).find((row) => row.status === "active") || null;
          const identifiers = (protectedHr?.identifiers || []).filter((row) => row.status === "active");
          const documents = (protectedHr?.documents || []).filter((row) => row.status === "active");
          return <>
            <div className="ev2p-admin-protected-grid">
              <div>
                <span>Salary & payroll</span>
                <strong>{compensation ? `${protectedMoney(compensation.amount_minor, compensation.currency)} · ${compensation.basis_label}` : "Not recorded"}</strong>
                <button type="button" className="ev2p-admin-record-change" onClick={() => setProtectedEditor({ type:"compensation", record:compensation })}>{compensation ? "Record change" : "Record salary"}</button>
              </div>
              <div>
                <span>Payment details</span>
                <strong>{payment ? `${payment.provider_name} · ${payment.account_name} · ${payment.account_reference}` : "Not recorded"}</strong>
                <button type="button" className="ev2p-admin-record-change" onClick={() => setProtectedEditor({ type:"payment_detail", record:payment })}>{payment ? "Record change" : "Record payment details"}</button>
              </div>
              <div>
                <span>Protected identifiers</span>
                <strong>{identifiers.length ? `${identifiers.length} active record${identifiers.length === 1 ? "" : "s"}` : "Not recorded"}</strong>
                <button type="button" className="ev2p-admin-record-change" onClick={() => setProtectedEditor({ type:"identifier", record:null })}>Record identifier</button>
              </div>
              <div>
                <span>Contracts & documents</span>
                <strong>{documents.length ? `${documents.length} active document${documents.length === 1 ? "" : "s"}` : "No protected document recorded"}</strong>
              </div>
            </div>
            {identifiers.length > 0 && <div className="ev2p-admin-history-list">
              {identifiers.map((row) => <article className="ev2p-admin-history-row" key={row.id}>
                <div><strong>{row.identifier_type}</strong><span>{row.identifier_value}</span></div>
                <span>{row.expires_on ? `Expires ${dateOnly(row.expires_on)}` : "Active"}</span>
              </article>)}
            </div>}
            <p className="ev2p-admin-protected-note">No salary, bank, identifier or Payroll value is inferred from role, attendance, performance or work records. Missing data remains explicitly missing until Administration records an authoritative value.</p>
          </>;
        })()}
      </PeopleWorkspaceSection>
      </>}

        </div>
      </div>

      {protectedEditor && <ProtectedHrComposer
        type={protectedEditor.type}
        record={protectedEditor.record}
        employee={person}
        busy={savingProtected}
        onClose={() => { if (!savingProtected) setProtectedEditor(null); }}
        onSave={saveProtectedRecord}
      />}

      {hasLinkedProfile && employmentEditor && employmentForm && <ComposerDrawer open title="Record employment change"
        description="This records a new historical snapshot. Earlier employment history is preserved."
        onClose={() => { if (!savingEmployment) { setEmploymentEditor(false); setEmploymentForm(null); } }}>

        <FieldGroup label="Change">
          <select className="field" aria-label="Change" value={employmentForm.changeType} onChange={(event) => setEmploymentForm({ ...employmentForm, changeType: event.target.value })}>
            {EMPLOYMENT_CHANGES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </FieldGroup>
        {employmentForm.changeType === "correction" && <FieldGroup label="Event being corrected">
          <select className="field" aria-label="Event being corrected" value={employmentForm.correctionOf} onChange={(event) => setEmploymentForm({ ...employmentForm, correctionOf: event.target.value })}>
            <option value="">Choose history event</option>
            {employmentHistory.map((event) => <option key={event.id} value={event.id}>{dateOnly(event.effective_on)} · {employmentChangeLabel(event.change_type)}</option>)}
          </select>
        </FieldGroup>}
        <FieldGroup label="Effective date"><input className="field" aria-label="Effective date" type="date" value={employmentForm.effectiveOn} onChange={(event) => setEmploymentForm({ ...employmentForm, effectiveOn: event.target.value })} /></FieldGroup>
        <FieldGroup label="Employment type">
          <select className="field" aria-label="Employment type" value={employmentForm.employmentType} onChange={(event) => setEmploymentForm({ ...employmentForm, employmentType: event.target.value, role: event.target.value === "volunteer" && employmentForm.role === "manager" ? "staff" : employmentForm.role, workingPattern: event.target.value === "volunteer" ? "no_attendance" : employmentForm.workingPattern })}>
            {!["not_recorded","permanent","fixed_term","volunteer"].includes(employmentForm.employmentType) && <option value={employmentForm.employmentType}>{employmentForm.employmentType}</option>}
            <option value="not_recorded">Not recorded</option>
            <option value="permanent">Permanent employee</option>
            <option value="fixed_term">Fixed-term employee</option>
            <option value="volunteer">Volunteer</option>
          </select>
        </FieldGroup>
        <FieldGroup label="Job title"><input className="field" aria-label="Job title" value={employmentForm.jobTitle} onChange={(event) => setEmploymentForm({ ...employmentForm, jobTitle: event.target.value })} /></FieldGroup>
        <FieldGroup label="Primary unit">
          <select className="field" aria-label="Primary unit" value={employmentForm.unitId} onChange={(event) => setEmploymentForm({ ...employmentForm, unitId: event.target.value, managerId: "" })}>
            <option value="">No primary unit</option>
            {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
          </select>
        </FieldGroup>
        <FieldGroup label="Role">
          <select className="field" aria-label="Role" value={employmentForm.role} onChange={(event) => setEmploymentForm({ ...employmentForm, role: event.target.value })}>
            <option value="staff">Staff</option>
            <option value="sub_team_lead">Team lead</option>
            {employmentForm.employmentType !== "volunteer" && <option value="manager">Unit head</option>}
          </select>
        </FieldGroup>
        <FieldGroup label="Manager">
          <select className="field" aria-label="Manager" value={employmentForm.managerId} onChange={(event) => setEmploymentForm({ ...employmentForm, managerId: event.target.value })}>
            <option value="">No manager recorded</option>
            {rows.filter((entry) => entry.profile_id && entry.profile_id !== person.profile_id && entry.active && entry.unit_id === employmentForm.unitId)
              .map((entry) => <option key={entry.employee_id || entry.id} value={entry.profile_id}>{entry.full_name}</option>)}
          </select>
        </FieldGroup>
        <FieldGroup label="Working pattern">
          <select className="field" aria-label="Working pattern" value={employmentForm.workingPattern} onChange={(event) => setEmploymentForm({ ...employmentForm, workingPattern: event.target.value })}>
            <option value="not_recorded">Not recorded</option>
            {employmentForm.employmentType === "volunteer" ? <>
              <option value="no_attendance">No attendance tracking</option>
              <option value="event_based">Event-based</option>
              <option value="specific_days">Specific days</option>
              <option value="custom">Custom schedule</option>
            </> : <>
              <option value="full_time">Full time</option>
              <option value="part_time">Part time</option>
              <option value="flexible">Flexible</option>
            </>}
          </select>
        </FieldGroup>
        <FieldGroup label="Employment status">
          <select className="field" aria-label="Employment status" value={employmentForm.status} onChange={(event) => setEmploymentForm({ ...employmentForm, status: event.target.value, exitedOn: event.target.value === "exited" ? employmentForm.exitedOn : "" })}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="exited">Exited</option>
          </select>
        </FieldGroup>
        <FieldGroup label="Joined"><input className="field" aria-label="Joined" type="date" value={employmentForm.joinedOn} onChange={(event) => setEmploymentForm({ ...employmentForm, joinedOn: event.target.value })} /></FieldGroup>
        {employmentForm.status === "exited" && <FieldGroup label="Exit date"><input className="field" aria-label="Exit date" type="date" value={employmentForm.exitedOn} onChange={(event) => setEmploymentForm({ ...employmentForm, exitedOn: event.target.value })} /></FieldGroup>}
        <FieldGroup label="Reason / context"><textarea className="field" aria-label="Reason / context" rows="3" value={employmentForm.reason} onChange={(event) => setEmploymentForm({ ...employmentForm, reason: event.target.value })} placeholder="Why this employment record changed" /></FieldGroup>

        {error && <ProductNotice tone="error" title="Employment change">{error}</ProductNotice>}
        <button className="btn" style={{ marginTop: 14 }} onClick={saveEmployment}
          disabled={savingEmployment || !employmentForm.effectiveOn || !employmentForm.employmentType.trim() || (employmentForm.status === "exited" && !employmentForm.exitedOn) || (employmentForm.changeType === "correction" && !employmentForm.correctionOf)}>
          {savingEmployment ? "Recording…" : "Record employment change"}
        </button>
      </ComposerDrawer>}
    </div>);
  }

  return renderPeoplePage(<>
    {viewMode === "access" && <PeopleAccess
      me={me}
      go={go}
      embedded
      initialProfileId={accessFocusProfileId}
      initialUnitId={accessFocusUnitId}
      initialMode={accessFocusMode}
      initialInviteRoster={accessInviteRoster?.requestedBy===me.id && accessInviteRoster?.orgId===me.org_id ? accessInviteRoster : null}
      onChanged={async () => { if (!(await load({ silent: true }))) throw new Error("People records could not be refreshed."); }}
      onLifecycle={(profileId, type) => openLifecycle?.(profileId, type)}
      onOpenPerson={(profileId) => {
        const match = rows.find((entry) => entry.profile_id === profileId);
        if (match) openPerson(match);
      }}
    />}

    {viewMode === "directory" && <PeopleEmpty title="Select an employee" description="Choose a person from the list to open their record." />}

    {viewMode === "attention" && unlinkedAccounts.length>0 && <section
      className="ev2p-account-reconciliation" aria-label="Operational accounts without linked employee records"
      style={{marginTop:20,border:"1px solid var(--ev2-line,var(--line))",borderRadius:10,padding:16}}>
      <header style={{display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap",alignItems:"center"}}>
        <div><span className="eyebrow">Identity reconciliation</span>
          <h2 className="h3">Operational accounts without HR roster links</h2>
          <p className="screen-note">These are existing CEAC accounts, not additional employees. Review the correct HR person and independent evidence before using the existing verified account-link workflow. No automatic matching or permission changes.</p>
        </div>
        <strong>{unlinkedAccounts.length} to review</strong>
      </header>
      <div style={{display:"grid",gap:8,marginTop:12}}>
        <div role="region" aria-label="Accounts without employee links" tabIndex={0} style={{maxHeight:360,overflow:"auto",overscrollBehavior:"contain"}}>
        {unmatchedAccounts.map(account=><article key={account.id}
          style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap",borderTop:"1px solid var(--ev2-line,var(--line))",paddingTop:9}}>
          <div style={{display:"grid",gap:2,minWidth:0}}>
            <strong>{account.full_name||"Operational account"}</strong>
            <span className="screen-note">{account.email||"Account email unavailable"} · {account.unit_name||"Unit unrecorded"} · Employee link not verified</span>
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={()=>{
              setSearchText(account.full_name||"");setFilter("all");setViewMode("directory");
            }}>Find roster person</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={()=>openAccessAdministration(account.id)}>Review account access</button>
          </div>
        </article>)}
        </div>
        {unmatchedAccounts.length===0&&<p className="screen-note">No unmatched accounts match the current search. Clear the search to review all accounts.</p>}
      </div>
    </section>}

    {viewMode === "directory" && shown.length === 0 && <div style={{ marginTop: "var(--ev2-space-5)" }}>
      <PeopleEmpty title="No employee selected" description="Choose a person from the directory to view their record." />
    </div>}

    {viewMode === "organisation" && <div>
      {groups.map((group) => <PeopleSection
        key={group.name}
        title={group.name}
        meta={`${group.people.length} recorded`}
        description="Recorded unit membership and role context only. Job titles never create authority."
      >
        {group.people.map((entry) => <PeopleAdminPersonRow
          key={entry.id}
          name={entry.full_name}
          src={entry.photo_url}
          subtitle={entry.job_title || entry.source_position || rankLabel(entry)}
          context={entry.identity_state === "roster_only" ? "Roster employee · no account required" : rankLabel(entry)}
          status={entry.identity_state === "needs_review" ? "Identity review" : entry.active ? "Active" : "Inactive"}
          statusTone={entry.identity_state === "needs_review" ? "warning" : entry.active ? "success" : "neutral"}
          primaryFact={entry.unit_name || entry.source_department_text || "No unit recorded"}
          secondaryFact={entry.profile_id ? "Account linked" : "Roster only"}
          onClick={() => openPerson(entry)}
        />)}
      </PeopleSection>)}
    </div>}

    {viewMode === "attention" && <div>
      <PeopleSection
        title="Employee records needing attention"
        meta={`${attentionRoster.length} recorded`}
        description="Only authoritative gaps are shown. Roster-only status by itself is not treated as a problem."
      >
        <div role="region" aria-label="Employee record gaps" tabIndex={0} style={{maxHeight:440,overflow:"auto",overscrollBehavior:"contain"}}>
        {attentionRoster.map((entry) => <PeopleAdminPersonRow
          key={entry.id}
          name={entry.full_name}
          src={entry.photo_url}
          subtitle={entry.job_title || entry.source_position || "Job title not recorded"}
          context={entry.unit_name || entry.source_department_text || "No unit recorded"}
          status="Needs attention"
          statusTone="warning"
          primaryFact={attentionReasons(entry)[0]}
          secondaryFact={attentionReasons(entry).slice(1).join(" · ")}
          onClick={() => openPerson(entry)}
        />)}
        </div>
        {!attentionRoster.length && <PeopleEmpty title="No employee record gaps are waiting" description="Roster-only employees remain valid employee records and are not treated as errors." />}
      </PeopleSection>

      <PeopleSection
        title="Units without a recorded head"
        meta={`${unitsWithoutHead.length} to review`}
        description="These units have no active account assigned as Unit Head. A job title alone does not grant that responsibility. Review the unit before changing its head."
      >
        <div role="region" aria-label="Units without a recorded head" tabIndex={0} style={{maxHeight:360,overflow:"auto",overscrollBehavior:"contain"}}>
        {unitsWithoutHead.map((unit) => <PeopleFactRow key={unit.id} icon="people" title={unit.name} subtitle="No active recorded Unit Head" meta="Review Units" tone="warning" />)}
        </div>
        {!unitsWithoutHead.length && <PeopleEmpty title="No Unit Head gap recorded" description="Every active unit has a recorded Unit Head." />}
      </PeopleSection>
    </div>}
  </>);
}


function ProtectedHrComposer({ type, record, employee, busy, onClose, onSave }) {
  const [amount,setAmount]=useState(record?.amount_minor == null ? "" : String(Number(record.amount_minor) / 100));
  const [currency,setCurrency]=useState(record?.currency || "GHS");
  const [basisLabel,setBasisLabel]=useState(record?.basis_label || "Monthly salary");
  const [effectiveOn,setEffectiveOn]=useState(record?.effective_on || new Date().toISOString().slice(0,10));
  const [providerName,setProviderName]=useState(record?.provider_name || "");
  const [accountName,setAccountName]=useState(record?.account_name || "");
  const [accountReference,setAccountReference]=useState(record?.account_reference || "");
  const [branchReference,setBranchReference]=useState(record?.branch_reference || "");
  const [identifierType,setIdentifierType]=useState(record?.identifier_type || "Ghana Card");
  const [identifierValue,setIdentifierValue]=useState(record?.identifier_value || "");
  const [issuedOn,setIssuedOn]=useState(record?.issued_on || "");
  const [expiresOn,setExpiresOn]=useState(record?.expires_on || "");
  const [reason,setReason]=useState("");

  const valid = reason.trim().length >= 3 && (
    type === "compensation" ? amountToMinor(amount) > 0 && basisLabel.trim() && effectiveOn :
    type === "payment_detail" ? providerName.trim() && accountName.trim() && accountReference.trim() :
    type === "identifier" ? identifierType.trim() && identifierValue.trim() :
    false
  );

  function submit() {
    if (!valid) return;
    const common={ replacesId:record?.id || null, reason:reason.trim() };
    if (type === "compensation") {
      onSave({
        ...common,
        recordType:"compensation",
        payload:{
          amount_minor:amountToMinor(amount),
          currency,
          basis_label:basisLabel.trim(),
          effective_on:effectiveOn,
        },
      });
      return;
    }
    if (type === "payment_detail") {
      onSave({
        ...common,
        recordType:"payment_detail",
        payload:{
          payment_type:"bank",
          provider_name:providerName.trim(),
          account_name:accountName.trim(),
          account_reference:accountReference.trim(),
          branch_reference:branchReference.trim() || null,
        },
      });
      return;
    }
    onSave({
      ...common,
      recordType:"identifier",
      payload:{
        identifier_type:identifierType.trim(),
        identifier_value:identifierValue.trim(),
        issued_on:issuedOn || null,
        expires_on:expiresOn || null,
      },
    });
  }

  const title=record
    ? "Correct protected HR record"
    : type === "compensation"
      ? "Record salary / compensation"
      : type === "payment_detail"
        ? "Record payment details"
        : "Record protected identifier";

  return <ComposerDrawer
    open
    onClose={onClose}
    title={title}
    description={`Protected HR · ${employee.full_name}. This creates an attributable record; corrections preserve the earlier version.`}
    footer={<>
      <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
      <Button onClick={submit} busy={busy} disabled={!valid}>{record ? "Record correction" : "Record protected HR"}</Button>
    </>}
  >
    {type === "compensation" && <>
      <FieldGroup label="Amount"><input className="field" inputMode="decimal" value={amount} onChange={(event)=>setAmount(event.target.value)} placeholder="0.00" /></FieldGroup>
      <FieldGroup label="Currency"><select className="field" value={currency} onChange={(event)=>setCurrency(event.target.value)}>{["GHS","USD","GBP","EUR","NGN","ZAR","CAD"].map((value)=><option key={value}>{value}</option>)}</select></FieldGroup>
      <FieldGroup label="Basis"><input className="field" value={basisLabel} onChange={(event)=>setBasisLabel(event.target.value)} /></FieldGroup>
      <FieldGroup label="Effective date"><input className="field" type="date" value={effectiveOn} onChange={(event)=>setEffectiveOn(event.target.value)} /></FieldGroup>
    </>}

    {type === "payment_detail" && <>
      <FieldGroup label="Bank / provider"><input className="field" value={providerName} onChange={(event)=>setProviderName(event.target.value)} /></FieldGroup>
      <FieldGroup label="Account name"><input className="field" value={accountName} onChange={(event)=>setAccountName(event.target.value)} /></FieldGroup>
      <FieldGroup label="Account number / reference"><input className="field" value={accountReference} onChange={(event)=>setAccountReference(event.target.value)} /></FieldGroup>
      <FieldGroup label="Branch / routing reference" hint="Optional"><input className="field" value={branchReference} onChange={(event)=>setBranchReference(event.target.value)} /></FieldGroup>
    </>}

    {type === "identifier" && <>
      <FieldGroup label="Identifier type"><select className="field" value={identifierType} onChange={(event)=>setIdentifierType(event.target.value)}><option>Ghana Card</option><option>SSNIT</option><option>TIN</option><option>Other identifier</option></select></FieldGroup>
      <FieldGroup label="Identifier value"><input className="field" value={identifierValue} onChange={(event)=>setIdentifierValue(event.target.value)} /></FieldGroup>
      <FieldGroup label="Issued on" hint="Optional"><input className="field" type="date" value={issuedOn} onChange={(event)=>setIssuedOn(event.target.value)} /></FieldGroup>
      <FieldGroup label="Expires on" hint="Optional"><input className="field" type="date" value={expiresOn} onChange={(event)=>setExpiresOn(event.target.value)} /></FieldGroup>
    </>}

    <FieldGroup label="Reason / source"><textarea className="field" rows="3" value={reason} onChange={(event)=>setReason(event.target.value)} placeholder="Why this value is authoritative" /></FieldGroup>
    <p className="screen-note">Protected values are never inferred from role, attendance, work output or Payroll state.</p>
  </ComposerDrawer>;
}
