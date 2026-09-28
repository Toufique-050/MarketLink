import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/authStore';
import api from '../services/api';

const DAYS=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
export function Login(){const {login,googleLogin}=useAuth();const nav=useNavigate();const [form,setForm]=useState({email:'',password:''});const [error,setError]=useState('');const [submitting,setSubmitting]=useState(false);function goTo(u){nav(u.role==='admin'?'/admin':u.role==='farmer'?'/farmer':'/dashboard')}async function submit(e){e.preventDefault();setError('');const email=form.email.trim();if(!email||!form.password){setError('Enter your email and password.');return}if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){setError('Enter a valid email address.');return}setSubmitting(true);try{goTo(await login(email,form.password))}catch(err){setError(err.response?.data?.message||'Login failed')}finally{setSubmitting(false)}}const onGoogle=useCallback(async(credential)=>{setError('');try{goTo(await googleLogin(credential))}catch(err){setError(err.response?.data?.message||'Google sign-in failed')}},[]);return <AuthBox title="Welcome back" subtitle="Sign in to manage your MarketLink account and marketplace activity." error={error}><form onSubmit={submit} noValidate><Field label="Email" type="email" value={form.email} autoComplete="email" onChange={v=>setForm({...form,email:v})}/><Field label="Password" type="password" value={form.password} autoComplete="current-password" onChange={v=>setForm({...form,password:v})}/><button className="button full" disabled={submitting}>{submitting?'Signing in…':'Sign in'}</button></form><Divider/><GoogleButton onCredential={onGoogle}/><p className="center">New to MarketLink? <Link to="/register" className="text-link">Create an account</Link></p></AuthBox>}
export function Register(){const {register,googleLogin}=useAuth();const nav=useNavigate();const [role,setRole]=useState('customer');const [form,setForm]=useState({name:'',email:'',password:'',phone:'',address:'',stallName:'',contactPerson:'',businessAddress:'',pickupWindowStart:'09:00',pickupWindowEnd:'15:00',cutoffMinutes:120,latitude:'',longitude:'',operatingDays:[]});const [phoneVerified,setPhoneVerified]=useState(false);const [error,setError]=useState('');const [submitting,setSubmitting]=useState(false);function toggleDay(day){setForm(f=>({...f,operatingDays:f.operatingDays.includes(day)?f.operatingDays.filter(x=>x!==day):[...f.operatingDays,day]}))}function goTo(u){nav(u.role==='farmer'?'/farmer':'/dashboard')}async function submit(e){e.preventDefault();setError('');const name=form.name.trim(),email=form.email.trim();if(!name||!email||!form.password){setError('Full name, email and password are required.');return}if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){setError('Enter a valid email address.');return}if(form.password.length<6){setError('Use at least 6 characters for your password.');return}if(role==='farmer'&&(!form.stallName.trim()||!form.contactPerson.trim())){setError('Farmer accounts require a business name and contact person.');return}setSubmitting(true);try{const payload={name,email,password:form.password,phone:form.phone.trim(),address:form.address.trim(),role};if(role==='farmer')payload.farmerProfile={stallName:form.stallName,contactPerson:form.contactPerson,businessAddress:form.businessAddress||form.address,pickupWindowStart:form.pickupWindowStart,pickupWindowEnd:form.pickupWindowEnd,cutoffMinutes:Number(form.cutoffMinutes),latitude:form.latitude===''?undefined:Number(form.latitude),longitude:form.longitude===''?undefined:Number(form.longitude),operatingDays:form.operatingDays};goTo(await register(payload))}catch(err){setError(err.response?.data?.message||'Registration failed')}finally{setSubmitting(false)}}const onGoogle=useCallback(async(credential)=>{setError('');try{goTo(await googleLogin(credential,role))}catch(err){setError(err.response?.data?.message||'Google sign-up failed')}},[role]);return <AuthBox title="Join MarketLink" subtitle="Create a customer or farmer account." error={error}><div className="role-toggle"><button type="button" className={role==='customer'?'active':''} onClick={()=>setRole('customer')}>Customer</button><button type="button" className={role==='farmer'?'active':''} onClick={()=>setRole('farmer')}>Farmer</button></div><GoogleButton onCredential={onGoogle}/><Divider label="or sign up with email"/><form onSubmit={submit}><Field label="Full name" value={form.name} onChange={v=>setForm({...form,name:v})}/><Field label="Email" type="email" value={form.email} onChange={v=>setForm({...form,email:v})}/><Field label="Password" type="password" value={form.password} onChange={v=>setForm({...form,password:v})}/><Field label="Phone" value={form.phone} onChange={v=>{setForm({...form,phone:v});setPhoneVerified(false)}}/><PhoneOtp phone={form.phone} verified={phoneVerified} onVerified={setPhoneVerified}/><Field label="Address" value={form.address} onChange={v=>setForm({...form,address:v})}/>{role==='farmer'&&<div className="panel inset"><h3>Farmer setup</h3><div className="form-grid"><Field label="Stall / business name" value={form.stallName} onChange={v=>setForm({...form,stallName:v})}/><Field label="Contact person" value={form.contactPerson} onChange={v=>setForm({...form,contactPerson:v})}/><Field label="Business address" value={form.businessAddress} onChange={v=>setForm({...form,businessAddress:v})}/><Field label="Cutoff minutes" type="number" value={form.cutoffMinutes} onChange={v=>setForm({...form,cutoffMinutes:v})}/><Field label="Pickup starts" type="time" value={form.pickupWindowStart} onChange={v=>setForm({...form,pickupWindowStart:v})}/><Field label="Pickup ends" type="time" value={form.pickupWindowEnd} onChange={v=>setForm({...form,pickupWindowEnd:v})}/><Field label="Latitude" type="number" value={form.latitude} onChange={v=>setForm({...form,latitude:v})}/><Field label="Longitude" type="number" value={form.longitude} onChange={v=>setForm({...form,longitude:v})}/></div><div className="chip-list">{DAYS.map(d=><button type="button" key={d} className={`chip ${form.operatingDays.includes(d)?'active':''}`} onClick={()=>toggleDay(d)}>{d}</button>)}</div><p className="hint">A farmer account starts as pending and needs admin approval before products can be listed.</p></div>}<button className="button full" disabled={submitting}>{submitting?'Creating account…':'Create account'}</button></form></AuthBox>}
function AuthBox({title,subtitle,error,children}){return <section className="auth-page"><div className="auth-visual" aria-hidden="true"><div className="auth-orbit auth-orbit-a"/><div className="auth-orbit auth-orbit-b"/><div className="auth-visual-copy"><span>LOCAL COMMERCE · REIMAGINED</span><strong>From trusted growers to everyday tables.</strong><small>One marketplace for products, pickup, farmers and local markets.</small></div></div><div className="auth-card"><div className="eyebrow">MARKETLINK ACCOUNT</div><h1>{title}</h1><p>{subtitle}</p>{error&&<div className="error" role="alert">{error}</div>}{children}</div></section>};function Field({label,type='text',value,onChange,autoComplete}){const optional=label==='Latitude'||label==='Longitude';return <label className="field"><span>{label}{optional&&<small> optional</small>}</span><input required={!optional} type={type} value={value} autoComplete={autoComplete} min={type==='number'&&label==='Cutoff minutes'?0:undefined} step={type==='number'&&['Latitude','Longitude'].includes(label)?'any':undefined} onChange={e=>onChange(e.target.value)}/></label>}
function Divider({label='or continue with'}){return <div className="auth-divider"><span/><small>{label}</small><span/></div>}

// Renders the "Sign in with Google" button using Google Identity Services
// (script tag loaded in index.html). Waits for window.google to be ready
// since the script loads async/defer.
function GoogleButton({onCredential}){
  const ref=useRef(null);
  const [ready,setReady]=useState(false);

  useEffect(()=>{
    let cancelled=false,interval;
    function render(){
      if(cancelled||!ref.current||!window.google)return;
      const clientId=import.meta.env.VITE_GOOGLE_CLIENT_ID;
      if(!clientId||clientId==='your_google_client_id'){
        ref.current.innerHTML='<p class="hint">Google sign-in not configured (missing VITE_GOOGLE_CLIENT_ID)</p>';
        return;
      }
      window.google.accounts.id.initialize({
        client_id:clientId,
        callback:(res)=>onCredential(res.credential),
        auto_select:false,
        cancel_on_tap_outside:true,
        use_fedcm_for_prompt:true
      });
      ref.current.innerHTML='';
      window.google.accounts.id.renderButton(ref.current,{
        theme:'outline',
        size:'large',
        width:320,
        text:'signin_with',
        shape:'rectangular'
      });
      setReady(true);
    }
    if(window.google)render();
    else interval=setInterval(()=>{if(window.google){render();clearInterval(interval)}},200);
    return ()=>{cancelled=true;if(interval)clearInterval(interval)};
  },[onCredential]);

  return <div className="google-auth-area">
    {!ready && <p className="hint">Loading Google sign-in...</p>}
    <div className="google-real-button" ref={ref}></div>
  </div>;
}

// Sends and verifies a Twilio SMS OTP for the phone number typed in the
// registration form. Verification is optional — it just marks the account
// as phoneVerified:true on the backend if completed before submit.
function PhoneOtp({phone,verified,onVerified}){
  const [sent,setSent]=useState(false);
  const [code,setCode]=useState('');
  const [status,setStatus]=useState('');
  const [busy,setBusy]=useState(false);
  async function sendCode(){
    if(!phone){setStatus('Enter your phone number first');return}
    setBusy(true);setStatus('');
    try{await api.post('/auth/send-otp',{phone});setSent(true);setStatus('Code sent via SMS')}
    catch(err){setStatus(err.response?.data?.message||'Failed to send code')}
    setBusy(false);
  }
  async function verifyCode(){
    setBusy(true);setStatus('');
    try{await api.post('/auth/verify-otp',{phone,code});onVerified(true);setStatus('')}
    catch(err){setStatus(err.response?.data?.message||'Invalid code')}
    setBusy(false);
  }
  if(verified)return <p className="hint">✓ Phone verified</p>;
  return <div className="otp-box">
    <button type="button" className="button small" disabled={busy} onClick={sendCode}>{sent?'Resend code':'Verify phone with SMS code'}</button>
    {sent&&<div className="otp-verify"><input placeholder="6-digit code" value={code} onChange={e=>setCode(e.target.value)}/><button type="button" className="button small" disabled={busy||!code} onClick={verifyCode}>Confirm</button></div>}
    {status&&<p className="hint">{status}</p>}
  </div>;
}
