import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { Avatar, EmptyState, FieldGroup, LoadingState, Pill, ProductNotice, Sheet } from "../components/bits";
import { humanError } from "../lib/productLanguage";
import { ComposerDrawer } from "../experience-v2/components";
import { WorkPageHeader } from "../experience-v2/work-family/WorkFamilyV2";
import { PersonalPageHeader } from "../experience-v2/personal-family/PersonalFamilyV2";

function human(value=""){
  return String(value).replaceAll("_"," ").replace(/\b\w/g,(m)=>m.toUpperCase());
}
function day(value){
  if(!value) return "Not recorded";
  return new Date(value+"T00:00:00").toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"});
}
function money(amount,currency){
  if(amount===null||amount===undefined||!currency) return "Not recorded";
  return currency+" "+Number(amount).toLocaleString("en-GB",{maximumFractionDigits:2});
}
function statusTone(status){
  if(status==="available") return "green";
  if(status==="assigned") return "blue";
  if(status==="repair") return "amber";
  if(status==="retired") return "grey";
  return "grey";
}

// Presentation follows the active panel; server-side asset authority is unchanged.
function AssetForm({ modern, title, description, error, onClose, children }) {
  if (!modern) return <Sheet onClose={onClose}>{children}</Sheet>;
  return <ComposerDrawer open title={title} description={description} onClose={onClose}>
    {error && <ProductNotice tone="error" title="Asset change not recorded">{error}</ProductNotice>}
    {children}
  </ComposerDrawer>;
}

export default function Assets({ me }) {
  const canManage=(me.capabilities||[]).includes("asset.manage");
  const [tab,setTab]=useState("inventory");
  const [assets,setAssets]=useState([]);
  const [assignments,setAssignments]=useState([]);
  const [lifecycle,setLifecycle]=useState([]);
  const [people,setPeople]=useState([]);
  const [units,setUnits]=useState([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState(null);
  const [notice,setNotice]=useState(null);

  const [assetSheet,setAssetSheet]=useState(false);
  const [editing,setEditing]=useState(null);
  const [assetCode,setAssetCode]=useState("");
  const [category,setCategory]=useState("");
  const [manufacturer,setManufacturer]=useState("");
  const [model,setModel]=useState("");
  const [serial,setSerial]=useState("");
  const [purchaseDate,setPurchaseDate]=useState("");
  const [purchaseVendor,setPurchaseVendor]=useState("");
  const [purchaseCost,setPurchaseCost]=useState("");
  const [purchaseCurrency,setPurchaseCurrency]=useState("");
  const [warranty,setWarranty]=useState("");
  const [assetUnit,setAssetUnit]=useState("");
  const [assetLocation,setAssetLocation]=useState("");
  const [conditionNote,setConditionNote]=useState("");
  const [assetNotes,setAssetNotes]=useState("");

  const [assignSheet,setAssignSheet]=useState(null);
  const [assignPerson,setAssignPerson]=useState("");
  const [assignUnit,setAssignUnit]=useState("");
  const [assignLocation,setAssignLocation]=useState("");
  const [expectedReturn,setExpectedReturn]=useState("");
  const [assignCondition,setAssignCondition]=useState("");
  const [assignReason,setAssignReason]=useState("");

  const [returnSheet,setReturnSheet]=useState(null);
  const [returnLocation,setReturnLocation]=useState("");
  const [returnCondition,setReturnCondition]=useState("");
  const [returnReason,setReturnReason]=useState("");

  const [lifeSheet,setLifeSheet]=useState(null);
  const [lifeAction,setLifeAction]=useState("");
  const [lifeNote,setLifeNote]=useState("");
  const [lifeReason,setLifeReason]=useState("");

  useEffect(()=>{ load(); },[me.id]);

  async function load(){
    setLoading(true); setError(null);
    const requests=[
      supabase.from("asset_items").select("*, assignee:profiles!asset_items_current_assignee_profile_id_fkey(full_name,email), unit:units!asset_items_current_unit_id_fkey(name)").order("asset_code"),
      supabase.from("asset_assignment_events").select("*, from_profile:profiles!asset_assignment_events_from_profile_id_fkey(full_name), to_profile:profiles!asset_assignment_events_to_profile_id_fkey(full_name), from_unit:units!asset_assignment_events_from_unit_id_fkey(name), to_unit:units!asset_assignment_events_to_unit_id_fkey(name)").order("occurred_at",{ascending:false}),
      supabase.from("asset_lifecycle_events").select("*, actor:profiles!asset_lifecycle_events_actor_id_fkey(full_name)").order("occurred_at",{ascending:false}),
    ];
    if(canManage){
      requests.push(
        supabase.from("profiles").select("id,full_name,email,active").eq("org_id",me.org_id).eq("active",true).order("full_name"),
        supabase.from("units").select("id,name,active").eq("org_id",me.org_id).eq("active",true).order("name")
      );
    }
    const results=await Promise.all(requests);
    const failed=results.find((row)=>row.error);
    if(failed){
      setError(humanError(failed.error,"Assets could not finish loading."));
      setLoading(false);
      return;
    }
    setAssets(results[0].data||[]);
    setAssignments(results[1].data||[]);
    setLifecycle(results[2].data||[]);
    if(canManage){
      setPeople(results[3].data||[]);
      setUnits(results[4].data||[]);
    }
    setLoading(false);
  }

  async function rpc(name,args,success){
    setBusy(true); setError(null); setNotice(null);
    const {error:e}=await supabase.rpc(name,args);
    if(e){ setBusy(false); setError(humanError(e,"That asset change could not be recorded.")); return false; }
    await load();
    setBusy(false); setNotice(success);
    return true;
  }

  function openCreate(){
    setError(null);
    setEditing(null);
    setAssetCode(""); setCategory(""); setManufacturer(""); setModel(""); setSerial("");
    setPurchaseDate(""); setPurchaseVendor(""); setPurchaseCost(""); setPurchaseCurrency("");
    setWarranty(""); setAssetUnit(""); setAssetLocation(""); setConditionNote(""); setAssetNotes("");
    setAssetSheet(true);
  }

  function openEdit(asset){
    setError(null);
    setEditing(asset);
    setAssetCode(asset.asset_code||""); setCategory(asset.category||"");
    setManufacturer(asset.manufacturer||""); setModel(asset.model||""); setSerial(asset.serial_number||"");
    setPurchaseDate(asset.purchase_date||""); setPurchaseVendor(asset.purchase_vendor||"");
    setPurchaseCost(asset.purchase_cost===null||asset.purchase_cost===undefined?"":String(asset.purchase_cost));
    setPurchaseCurrency(asset.purchase_currency||""); setWarranty(asset.warranty_expires_on||"");
    setAssetUnit(asset.current_unit_id||""); setAssetLocation(asset.current_location||"");
    setConditionNote(asset.current_condition_note||""); setAssetNotes(asset.notes||"");
    setAssetSheet(true);
  }

  async function saveAsset(){
    const cost=purchaseCost===""?null:Number(purchaseCost);
    const ok=await rpc("asset_record_item",{
      p_asset_id:editing?.id||null,
      p_asset_code:assetCode.trim(),
      p_category:category.trim(),
      p_manufacturer:manufacturer.trim()||null,
      p_model:model.trim()||null,
      p_serial_number:serial.trim()||null,
      p_purchase_date:purchaseDate||null,
      p_purchase_vendor:purchaseVendor.trim()||null,
      p_purchase_cost:Number.isFinite(cost)?cost:null,
      p_purchase_currency:purchaseCurrency.trim()?purchaseCurrency.trim().toUpperCase():null,
      p_warranty_expires_on:warranty||null,
      p_unit_id:assetUnit||null,
      p_location:assetLocation.trim()||null,
      p_condition_note:conditionNote.trim()||null,
      p_notes:assetNotes.trim()||null,
    },editing?"Asset details updated.":"Asset added to inventory.");
    if(ok) setAssetSheet(false);
  }

  function openAssign(asset){
    setError(null);
    setAssignSheet(asset);
    setAssignPerson(asset.current_assignee_profile_id||"");
    setAssignUnit(asset.current_unit_id||"");
    setAssignLocation(asset.current_location||"");
    setExpectedReturn("");
    setAssignCondition(asset.current_condition_note||"");
    setAssignReason("");
  }

  async function assignAsset(){
    const ok=await rpc("asset_assign",{
      p_asset_id:assignSheet.id,
      p_profile_id:assignPerson||null,
      p_unit_id:assignUnit||null,
      p_location:assignLocation.trim()||null,
      p_expected_return_on:expectedReturn||null,
      p_condition_note:assignCondition.trim()||null,
      p_reason:assignReason.trim(),
    },assignSheet.current_status==="assigned"?"Asset custody transferred.":"Asset assigned.");
    if(ok) setAssignSheet(null);
  }

  function openReturn(asset){
    setError(null);
    setReturnSheet(asset);
    setReturnLocation(asset.current_location||"");
    setReturnCondition(asset.current_condition_note||"");
    setReturnReason("");
  }

  async function returnAsset(){
    const ok=await rpc("asset_return",{
      p_asset_id:returnSheet.id,
      p_location:returnLocation.trim()||null,
      p_condition_note:returnCondition.trim()||null,
      p_reason:returnReason.trim(),
    },"Asset returned.");
    if(ok) setReturnSheet(null);
  }

  function openLifecycle(asset,action){
    setError(null);
    setLifeSheet(asset); setLifeAction(action); setLifeNote(""); setLifeReason("");
  }

  async function lifecycleAction(){
    const ok=await rpc("asset_lifecycle_action",{
      p_asset_id:lifeSheet.id,
      p_action:lifeAction,
      p_note:lifeNote.trim()||null,
      p_reason:lifeReason.trim(),
    },human(lifeAction)+" recorded.");
    if(ok) setLifeSheet(null);
  }

  const assigned=useMemo(()=>assets.filter((asset)=>asset.current_status==="assigned"),[assets]);
  const service=useMemo(()=>assets.filter((asset)=>asset.current_status==="repair"||asset.current_status==="retired"),[assets]);

  if(loading) return <div className="body"><LoadingState label="Loading assets & devices…" /></div>;

  const personalAssets = !canManage && !me.is_admin;
  return <div className={`body assets-page ${personalAssets ? "ev2-personal-page ev2-personal-assets" : ""}`.trim()}>
    {personalAssets ? <PersonalPageHeader
      eyebrow="My Hub"
      title="Assets & devices"
      description="CEAC equipment currently in your custody, with factual assignment and lifecycle history. This surface does not remotely manage your device."
      statusLabel="My custody"
    /> : me.is_admin ? <WorkPageHeader eyebrow="Enterprise asset register" title="Assets & devices" description="CEAC equipment, current custody, repairs and recorded history. This register does not remotely wipe, lock, configure or monitor device operating systems." /> : <div style={{paddingTop:26}}>
      <div className="eyebrow">Enterprise asset register</div>
      <h1 className="h1">Assets & devices</h1>
      <p className="screen-note">CEAC inventory, custody and lifecycle history. This module records operational facts; it does not remotely wipe, lock, configure or monitor device operating systems.</p>
    </div>}

    {error&&<ProductNotice tone="error" title="Assets & devices">{error}</ProductNotice>}
    {notice&&<ProductNotice tone="success" title="Recorded">{notice}</ProductNotice>}

    <div className="asset-tabs" role="tablist" aria-label="Asset sections">
      {[["inventory",canManage?"Inventory":"My assets"],["assigned","Assigned"],["service","Service & lifecycle"],["history","History"]].map(([key,label])=>
        <button key={key} role="tab" aria-selected={tab===key} className={tab===key?"on":""} onClick={()=>setTab(key)}>{label}</button>
      )}
    </div>

    {tab==="inventory"&&<>
      <div className="sec"><span>{canManage?"Visible inventory":"Assets in your custody"}</span>{canManage&&<button className="btn btn-sm" onClick={openCreate}>Add asset</button>}</div>
      <div className="asset-grid">
        {assets.map((asset)=><article className="card asset-card" key={asset.id}>
          <div className="asset-card-head">
            <div><span className="eyebrow">{asset.asset_code}</span><h3>{asset.manufacturer||asset.category}{asset.model?" · "+asset.model:""}</h3></div>
            <Pill tone={statusTone(asset.current_status)}>{human(asset.current_status)}</Pill>
          </div>
          <div className="asset-facts">
            <span>Category <b>{asset.category}</b></span>
            <span>Serial <b>{asset.serial_number||"Not recorded"}</b></span>
            <span>Custodian <b>{asset.assignee?.full_name||"Not assigned to a person"}</b></span>
            <span>Unit <b>{asset.unit?.name||"Not recorded"}</b></span>
            <span>Location <b>{asset.current_location||"Not recorded"}</b></span>
            <span>Condition <b>{asset.current_condition_note||"Not recorded"}</b></span>
            <span>Purchase <b>{money(asset.purchase_cost,asset.purchase_currency)}</b></span>
            <span>Purchased on <b>{day(asset.purchase_date)}</b></span>
            <span>Warranty to <b>{day(asset.warranty_expires_on)}</b></span>
          </div>
          {canManage&&<div className="asset-actions">
            <button className="btn btn-ghost btn-sm" onClick={()=>openEdit(asset)}>Edit details</button>
            {asset.current_status!=="repair"&&asset.current_status!=="retired"&&<button className="btn btn-ghost btn-sm" onClick={()=>openAssign(asset)}>{asset.current_status==="assigned"?"Transfer":"Assign"}</button>}
            {asset.current_status==="assigned"&&<button className="btn btn-ghost btn-sm" onClick={()=>openReturn(asset)}>Return</button>}
            {asset.current_status==="available"&&<button className="btn btn-ghost btn-sm" onClick={()=>openLifecycle(asset,"repair_started")}>Start repair</button>}
            {asset.current_status==="repair"&&<button className="btn btn-ghost btn-sm" onClick={()=>openLifecycle(asset,"repair_completed")}>Complete repair</button>}
            {asset.current_status!=="retired"&&<button className="btn btn-ghost btn-sm" onClick={()=>openLifecycle(asset,"warranty_claimed")}>Warranty claim</button>}
            {asset.current_status!=="assigned"&&asset.current_status!=="retired"&&<button className="btn btn-ghost btn-sm" onClick={()=>openLifecycle(asset,"retired")}>Retire</button>}
          </div>}
        </article>)}
      </div>
      {!assets.length&&<EmptyState title={canManage?"No assets recorded yet":"No assets are currently assigned to you"}>{canManage?"Add the first CEAC asset/device to begin the register.":"Your assigned CEAC equipment will appear here when custody is recorded."}</EmptyState>}
    </>}

    {tab==="assigned"&&<>
      <div className="sec"><span>Current assignments</span><span>{assigned.length}</span></div>
      {assigned.map((asset)=><div className="row" key={asset.id}>
        <div className="row-t">{asset.asset_code} · {asset.category}</div>
        <div className="row-m">{asset.assignee?.full_name||"Unit custody"} · {asset.unit?.name||"Unit not recorded"} · {asset.current_location||"Location not recorded"}</div>
      </div>)}
      {!assigned.length&&<EmptyState compact title="No current assignments">No visible asset is currently in assigned status.</EmptyState>}
    </>}

    {tab==="service"&&<>
      <div className="sec"><span>Service & retired assets</span><span>{service.length}</span></div>
      {service.map((asset)=><div className="row" key={asset.id}>
        <div className="row-t">{asset.asset_code} · {asset.manufacturer||asset.category}{asset.model?" "+asset.model:""}</div>
        <div className="row-m">{human(asset.current_status)} · {asset.current_condition_note||"Condition not recorded"}</div>
      </div>)}
      <div className="sec"><span>Lifecycle history</span></div>
      {lifecycle.map((event)=><div className="row" key={event.id}>
        <div className="row-t">{human(event.action)}</div>
        <div className="row-m">{new Date(event.occurred_at).toLocaleString("en-GB")} · {human(event.from_status)} → {human(event.to_status)}{event.actor?.full_name?" · "+event.actor.full_name:""}</div>
        {event.note&&<div className="row-note">{event.note}</div>}
        <div className="row-note">{event.reason}</div>
      </div>)}
      {!lifecycle.length&&<EmptyState compact title="No lifecycle events recorded">Repairs, warranty claims and retirement events will appear here.</EmptyState>}
    </>}

    {tab==="history"&&<>
      <div className="sec"><span>Custody history</span></div>
      {assignments.map((event)=><div className="row asset-history-row" key={event.id}>
        <div className="row-t">{human(event.action)}</div>
        <div className="row-m">{new Date(event.occurred_at).toLocaleString("en-GB")}</div>
        <div className="row-note">{event.from_profile?.full_name||event.from_unit?.name||event.from_location||"Available"} → {event.to_profile?.full_name||event.to_unit?.name||event.to_location||"Available"}</div>
        {event.expected_return_on&&<div className="row-note">Expected return: {day(event.expected_return_on)}</div>}
        {event.condition_note&&<div className="row-note">Condition: {event.condition_note}</div>}
        <div className="row-note">{event.reason}</div>
      </div>)}
      {!assignments.length&&<EmptyState compact title="No custody history in your scope">Assignments, transfers and returns will appear here.</EmptyState>}
    </>}

    {assetSheet&&<AssetForm modern={me.is_admin} title={editing?"Edit asset":"Add asset"} description="Record factual equipment details and the purchase currency, where known." error={error} onClose={()=>!busy&&setAssetSheet(false)}>
      {!me.is_admin && <><div className="eyebrow">{editing?"Edit asset":"New asset"}</div>
      <div className="h2">{editing?"Update factual asset details":"Add asset to CEAC inventory"}</div></>}
      <div className="form-grid two">
        <FieldGroup label="Asset ID / tag"><input className="field" aria-label="Asset code" value={assetCode} onChange={e=>setAssetCode(e.target.value)} placeholder="e.g. CEAC-LAP-014"/></FieldGroup>
        <FieldGroup label="Category"><input className="field" aria-label="Asset category" value={category} onChange={e=>setCategory(e.target.value)} placeholder="Laptop, camera, mixer…"/></FieldGroup>
        <FieldGroup label="Manufacturer"><input className="field" aria-label="Asset manufacturer" value={manufacturer} onChange={e=>setManufacturer(e.target.value)}/></FieldGroup>
        <FieldGroup label="Model"><input className="field" aria-label="Asset model" value={model} onChange={e=>setModel(e.target.value)}/></FieldGroup>
        <FieldGroup label="Serial number"><input className="field" aria-label="Asset serial number" value={serial} onChange={e=>setSerial(e.target.value)}/></FieldGroup>
        <FieldGroup label="Unit"><select className="field" aria-label="Asset unit" value={assetUnit} onChange={e=>setAssetUnit(e.target.value)}><option value="">Not recorded</option>{units.map(unit=><option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></FieldGroup>
        <FieldGroup label="Purchase date"><input className="field" aria-label="Asset purchase date" type="date" value={purchaseDate} onChange={e=>setPurchaseDate(e.target.value)}/></FieldGroup>
        <FieldGroup label="Vendor"><input className="field" aria-label="Asset purchase vendor" value={purchaseVendor} onChange={e=>setPurchaseVendor(e.target.value)}/></FieldGroup>
        <FieldGroup label="Purchase amount"><input className="field" aria-label="Asset purchase cost" type="number" min="0" step="0.01" value={purchaseCost} onChange={e=>setPurchaseCost(e.target.value)}/></FieldGroup>
        <FieldGroup label="Currency" hint="Three-letter code; no conversion is inferred."><input className="field" aria-label="Asset purchase currency" maxLength="3" value={purchaseCurrency} onChange={e=>setPurchaseCurrency(e.target.value.toUpperCase())} placeholder="GHS"/></FieldGroup>
        <FieldGroup label="Warranty expires"><input className="field" aria-label="Asset warranty expiry" type="date" value={warranty} onChange={e=>setWarranty(e.target.value)}/></FieldGroup>
        <FieldGroup label="Location"><input className="field" aria-label="Asset location" value={assetLocation} onChange={e=>setAssetLocation(e.target.value)} placeholder="Store, studio, office…"/></FieldGroup>
      </div>
      <FieldGroup label="Condition note"><textarea className="field" aria-label="Asset condition note" rows="2" value={conditionNote} onChange={e=>setConditionNote(e.target.value)}/></FieldGroup>
      <FieldGroup label="Notes"><textarea className="field" aria-label="Asset notes" rows="2" value={assetNotes} onChange={e=>setAssetNotes(e.target.value)}/></FieldGroup>
      <button className="btn" style={{marginTop:14}} disabled={busy||assetCode.trim().length<2||category.trim().length<2||((purchaseCost==="")!== (purchaseCurrency===""))} onClick={saveAsset}>{busy?"Saving…":editing?"Update asset":"Add asset"}</button>
    </AssetForm>}

    {assignSheet&&<AssetForm modern={me.is_admin} title={assignSheet.current_status==="assigned"?"Transfer custody":"Assign asset"} description={assignSheet.asset_code} error={error} onClose={()=>!busy&&setAssignSheet(null)}>
      {!me.is_admin && <><div className="eyebrow">{assignSheet.current_status==="assigned"?"Transfer custody":"Assign asset"}</div>
      <div className="h2">{assignSheet.asset_code}</div></>}
      <FieldGroup label="Person"><select className="field" aria-label="Asset assignee" value={assignPerson} onChange={e=>{
        const id=e.target.value; setAssignPerson(id);
      }}><option value="">Unit custody only</option>{people.map(person=><option key={person.id} value={person.id}>{person.full_name}</option>)}</select></FieldGroup>
      <FieldGroup label="Unit"><select className="field" aria-label="Asset assignment unit" value={assignUnit} onChange={e=>setAssignUnit(e.target.value)}><option value="">Choose unit</option>{units.map(unit=><option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></FieldGroup>
      <FieldGroup label="Location"><input className="field" aria-label="Asset assignment location" value={assignLocation} onChange={e=>setAssignLocation(e.target.value)}/></FieldGroup>
      <FieldGroup label="Expected return" hint="Optional."><input className="field" aria-label="Asset expected return" type="date" value={expectedReturn} onChange={e=>setExpectedReturn(e.target.value)}/></FieldGroup>
      <FieldGroup label="Condition at handover"><textarea className="field" aria-label="Asset assignment condition" rows="2" value={assignCondition} onChange={e=>setAssignCondition(e.target.value)}/></FieldGroup>
      <FieldGroup label="Reason"><textarea className="field" aria-label="Asset assignment reason" rows="2" value={assignReason} onChange={e=>setAssignReason(e.target.value)}/></FieldGroup>
      <button className="btn" style={{marginTop:14}} disabled={busy||(!assignPerson&&!assignUnit)||assignReason.trim().length<3} onClick={assignAsset}>{busy?"Recording…":assignSheet.current_status==="assigned"?"Transfer custody":"Assign asset"}</button>
    </AssetForm>}

    {returnSheet&&<AssetForm modern={me.is_admin} title="Return asset" description={returnSheet.asset_code} error={error} onClose={()=>!busy&&setReturnSheet(null)}>
      {!me.is_admin && <><div className="eyebrow">Return asset</div><div className="h2">{returnSheet.asset_code}</div></>}
      <FieldGroup label="Return location"><input className="field" aria-label="Asset return location" value={returnLocation} onChange={e=>setReturnLocation(e.target.value)}/></FieldGroup>
      <FieldGroup label="Condition on return"><textarea className="field" aria-label="Asset return condition" rows="3" value={returnCondition} onChange={e=>setReturnCondition(e.target.value)}/></FieldGroup>
      <FieldGroup label="Reason"><textarea className="field" aria-label="Asset return reason" rows="2" value={returnReason} onChange={e=>setReturnReason(e.target.value)}/></FieldGroup>
      <button className="btn" style={{marginTop:14}} disabled={busy||returnReason.trim().length<3} onClick={returnAsset}>{busy?"Recording…":"Record return"}</button>
    </AssetForm>}

    {lifeSheet&&<AssetForm modern={me.is_admin} title={human(lifeAction)} description={lifeSheet.asset_code} error={error} onClose={()=>!busy&&setLifeSheet(null)}>
      {!me.is_admin && <><div className="eyebrow">Asset lifecycle</div><div className="h2">{human(lifeAction)} · {lifeSheet.asset_code}</div></>}
      <FieldGroup label="Note"><textarea className="field" aria-label="Asset lifecycle note" rows="3" value={lifeNote} onChange={e=>setLifeNote(e.target.value)} placeholder="Repair details, warranty reference or retirement context"/></FieldGroup>
      <FieldGroup label="Reason"><textarea className="field" aria-label="Asset lifecycle reason" rows="2" value={lifeReason} onChange={e=>setLifeReason(e.target.value)}/></FieldGroup>
      <button className="btn" style={{marginTop:14}} disabled={busy||lifeReason.trim().length<3} onClick={lifecycleAction}>{busy?"Recording…":"Record "+human(lifeAction).toLowerCase()}</button>
    </AssetForm>}
  </div>;
}
