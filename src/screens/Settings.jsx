import {useEffect, useState, useRef, useCallback, lazy, Suspense} from 'react';
import {Sun, Moon, RefreshCw, Settings as SettingsIcon, Bell, ShieldCheck, ChevronRight, ArrowLeft, Building2} from 'lucide-react';
import {supabase} from '../lib/supabase';
import {applyAppearance, readAppearance} from '../lib/appearance';
import {loadPushConfiguration, pushSupport} from '../lib/ceacPush';
import {humanError} from '../lib/productLanguage';
import './Settings.css';
const AccountActivity = lazy(() => import('./AccountActivity'));
const Notifications = lazy(() => import('./Notifications'));
const sections = ['appearance','notifications','security'];
const labels = {system:'Use device setting', light:'Light', dark:'Dark'};
export default function Settings({me, notificationCounts, go}) {
  const [section,setSection] = useState(() => {const value = new URLSearchParams(location.search).get('preference');return sections.includes(value)?value:null;});
  const [appearance,setAppearance] = useState(readAppearance);
  const roleLabel=me.is_admin?'Administration & HR':me.is_exec?'Executive':String(me.role||'Member').replaceAll('_',' ').replace(/\b\w/g,letter=>letter.toUpperCase());
  const onSecurityChanged=useCallback(()=>setSecurity('Authenticator enabled'),[]);
  const [email,setEmail]=useState(me.email || '');
  const [security,setSecurity] = useState('Checking protection…');
  const [device,setDevice] = useState('Check this device');
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const detailRef=useRef(null);
  const onDeviceStatus=useCallback(status=>setDevice(({enabled:'On for this device',available:'Off for this device',blocked:'Blocked on this device',install_required:'Home Screen setup needed',unavailable:'Unavailable in this browser',check_failed:'Status unavailable',loading:'Checking this device…',unconfigured:'Setup not available yet'})[status]||'Check this device'),[]);
  const [confirmSignOut,setConfirmSignOut] = useState(false);
  useEffect(() => {
    const update=()=>setAppearance(document.documentElement.dataset.appearance || 'system');
    window.addEventListener('ceac:appearance',update);
    let active=true;
    supabase.auth.getSession().then(({data})=>{if(active&&data?.session?.user?.email)setEmail(data.session.user.email);}).catch(()=>{});
    if(pushSupport()!=='supported')setDevice(pushSupport()==='install_required'?'Home Screen setup needed':'Unavailable in this browser');
    else if(Notification.permission==='denied')setDevice('Blocked on this device');
    else loadPushConfiguration().then(config=>{if(active)setDevice(config?.subscription?'On for this device':'Off for this device');}).catch(()=>{if(active)setDevice('Status unavailable');});
    supabase.auth.mfa.listFactors().then(({data,error})=>{if(active)setSecurity(error?'Status unavailable':data?.totp?.some(f=>f.status==='verified')?'Authenticator enabled':'Authenticator not set up');}).catch(()=>{if(active)setSecurity('Status unavailable');});
    return ()=>{active=false;window.removeEventListener('ceac:appearance',update);};
  },[]);
  function open(value) { setSection(value); requestAnimationFrame(()=>{const target=value?detailRef.current?.querySelector('h2,h1'):document.querySelector('.ceac-settings-index nav button');if(target){target.setAttribute('tabindex','-1');target.focus();}}); const url=new URL(location.href);if(value)url.searchParams.set('preference',value);else url.searchParams.delete('preference');history.replaceState(history.state,'',url); }
  async function signOut() {
    if(busy)return;setBusy(true);setError('');
    try {const result=await supabase.auth.signOut({scope:'local'});if(result.error)throw result.error;}
    catch(error){setError(humanError(error,'Could not sign out. Please retry.'));}
    finally{setBusy(false);}
  }
  const rows=[['appearance',Sun,'Appearance',labels[appearance]],['notifications',Bell,'Notifications',device],['security',ShieldCheck,'Account & Security',security]];
  return <section className={'body ceac-settings'+(section?' has-section':'')} aria-label="Settings">
    <header><span className="eyebrow">Your preferences</span><h1>Settings</h1><p>Make CEAC feel right for you.</p></header>
    <div className="ceac-settings-layout"><aside className="ceac-settings-index">
      <div className="ceac-settings-identity"><span className="ceac-settings-avatar">{(me.full_name||'CEAC').split(' ').map(n=>n[0]).slice(0,2).join('')}</span><div><strong>{me.full_name || 'Your account'}</strong><small>{[me.unit_name,roleLabel].filter(Boolean).join(' · ')}</small></div></div>
      <nav aria-label="Personal settings">{rows.map(([id,Icon,title,status])=><button key={id} type="button" aria-current={section===id?'page':undefined} onClick={()=>open(id)}><Icon size={20}/><span><strong>{title}</strong><small>{status}</small></span><ChevronRight size={16}/></button>)}</nav>
      {me.is_admin&&<div className="ceac-settings-group"><h2>Organisation</h2><button type="button" onClick={()=>go('settings')}><Building2 size={20}/><span><strong>Organisation settings</strong><small>Affects the organisation</small></span><ChevronRight size={16}/></button></div>}
      <div className="ceac-settings-group"><p>Signed in as {email || me.full_name}</p>{!confirmSignOut?<button className="ceac-signout" type="button" onClick={()=>setConfirmSignOut(true)}>Sign out</button>:<div role="group" aria-label="Confirm sign out"><p>Sign out on this device? Finish or save your work first.</p><button type="button" disabled={busy} onClick={()=>void signOut()}>{busy?'Signing out…':'Sign out on this device'}</button><button type="button" disabled={busy} onClick={()=>setConfirmSignOut(false)}>Stay signed in</button></div>}{error&&<p role="alert">{error}</p>}</div>
    </aside><div ref={detailRef} className="ceac-settings-detail">
      {section&&<button className="ceac-settings-back" type="button" onClick={()=>open(null)}><ArrowLeft size={18}/> Settings</button>}
      {!section?<div className="ceac-settings-welcome"><SettingsIcon size={32}/><h2>Your CEAC, your way</h2><p>Choose a section to manage your appearance, notifications or account security.</p></div>:section==='appearance'?<section aria-label="Appearance"><h2>Appearance</h2><p>Choose how CEAC looks on this device.</p><fieldset className="ceac-appearance-options"><legend className="sr-only">Appearance</legend>{[['light',Sun],['dark',Moon],['system',RefreshCw]].map(([mode,Icon])=><label key={mode}><input type="radio" name="appearance" value={mode} checked={appearance===mode} onChange={()=>setAppearance(applyAppearance(mode))}/><span className={'ceac-theme-preview preview-'+mode} aria-hidden="true"><i/><span><b/><b/><b/></span></span><span><Icon size={17}/>{labels[mode]}</span></label>)}</fieldset><p className="ceac-settings-note" role="status">{appearance==='system'?'CEAC follows this device, including automatic changes between day and night.':`${labels[appearance]} appearance is selected on this device.`} Changes are applied immediately.</p></section>:<Suspense fallback={<p role="status">Opening settings…</p>}>{section==='security'?<AccountActivity me={{...me,email}} onSecurityChanged={onSecurityChanged}/>:<Notifications me={me} notificationCounts={notificationCounts} settingsOnly onDeviceStatus={onDeviceStatus}/>}</Suspense>}
    </div></div>
  </section>;
}
