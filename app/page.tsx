'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  LogOut, Plus, Camera, Image as ImageIcon, CalendarDays, WalletCards, ReceiptText,
  BadgeDollarSign, Banknote, ArrowLeftRight, CheckCircle2, X, ChevronRight,
  Trash2, Pencil, RotateCcw, Eye, EyeOff, TrendingDown, TrendingUp
} from 'lucide-react';
import {
  AppData, Account, TxType, FinanceType, DEFAULT_DATA, loadData, saveData, calculateFee,
  getBalances, money, todayISO, totalRevenue, totalCapital, totalWithdrawals, validateTransaction,
  totalCashInProcessed, totalCashOutProcessed,
  hashText, getLocalUser, setLocalUser, setSession, hasSession, saveReceipt, getReceipt
} from '@/lib/store';

type Tab = 'TRANSACTION' | 'RATES' | 'FINANCE';
type Toast = { id: number; kind: 'success' | 'error'; message: string };
type TxFilter = 'ALL' | TxType;

function uid(prefix='id') { return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`; }

function beep(success=true) {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = success ? 880 : 220;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.14, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2);
    osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + 0.22);
  } catch {}
}

function Field({label, children}:{label:string; children:React.ReactNode}) {
  return <label className="block space-y-2"><span className="text-xs font-medium text-slate-600">{label}</span>{children}</label>;
}
const inputClass = 'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100';
const btnPrimary = 'rounded-2xl blue-gradient px-4 py-3 font-medium text-white shadow-lg shadow-blue-200 active:scale-[.99] disabled:opacity-40';
const btnGhost = 'rounded-2xl border border-slate-200 bg-white px-4 py-3 font-medium text-slate-700 active:bg-slate-50';

function Modal({open, title, children, onClose}:{open:boolean; title:string; children:React.ReactNode; onClose:()=>void}) {
  if (!open) return null;
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 sm:items-center sm:p-5">
    <div className="max-h-[94dvh] w-full max-w-xl overflow-y-auto rounded-t-[28px] bg-white p-4 shadow-2xl sm:rounded-[28px] sm:p-5">
      <div className="mb-5 flex items-center justify-between"><h2 className="text-xl">{title}</h2><button onClick={onClose} className="rounded-full bg-slate-100 p-2"><X size={18}/></button></div>
      {children}
    </div>
  </div>
}

function Confirm({open, message, onNo, onYes}:{open:boolean; message:string; onNo:()=>void; onYes:()=>void}) {
  return <Modal open={open} title="Please confirm" onClose={onNo}>
    <p className="text-sm leading-6 text-slate-600">{message}</p>
    <div className="mt-5 grid grid-cols-2 gap-3"><button onClick={onNo} className={btnGhost}>No</button><button onClick={onYes} className={btnPrimary}>Yes, cancel</button></div>
  </Modal>
}

function ToastCenter({toasts}:{toasts:Toast[]}) {
  if (!toasts.length) return null;
  return <div className="pointer-events-none fixed inset-0 z-[90] flex items-center justify-center px-5">
    <div className="space-y-3">
      {toasts.map(t=><div key={t.id} className={`pointer-events-auto min-w-[250px] max-w-sm rounded-[24px] bg-white px-6 py-5 text-center shadow-2xl ring-1 ${t.kind==='success'?'ring-emerald-100':'ring-rose-100'}`}>
        <div className={`mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full ${t.kind==='success'?'bg-emerald-50 text-emerald-500':'bg-rose-50 text-rose-500'}`}>
          {t.kind==='success'?<CheckCircle2 size={34}/>:<X size={32}/>} 
        </div>
        <div className="text-sm font-medium text-slate-700">{t.message}</div>
      </div>)}
    </div>
  </div>
}

export default function Home() {
  const [ready, setReady] = useState(false);
  const [splash, setSplash] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [data, setData] = useState<AppData>(DEFAULT_DATA);
  const [tab, setTab] = useState<Tab>('TRANSACTION');
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    setData(loadData());
    setLoggedIn(hasSession());
    setReady(true);
    const t = setTimeout(() => setSplash(false), 1000);
    const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
    // Never let a service worker cache Next.js dev assets on localhost.
    // Register it only in production (GitHub Pages / deployed HTTPS build).
    if ('serviceWorker' in navigator) {
      if (process.env.NODE_ENV === 'production') {
        navigator.serviceWorker.register(`${base}/sw.js`).catch(()=>{});
      } else {
        navigator.serviceWorker.getRegistrations().then((regs) => {
          regs.forEach((reg) => reg.unregister());
        }).catch(()=>{});
        if ('caches' in window) {
          caches.keys().then((keys) => keys.forEach((key) => caches.delete(key))).catch(()=>{});
        }
      }
    }
    return () => clearTimeout(t);
  }, []);
  useEffect(() => { if (ready) saveData(data); }, [data, ready]);

  const toast = (message:string, kind:'success'|'error'='success') => {
    const id = Date.now();
    setToasts([{id,kind,message}]);
    beep(kind==='success');
    setTimeout(()=>setToasts((t)=>t.filter(x=>x.id!==id)), 1800);
  };

  if (splash) return <Splash/>;
  if (!loggedIn) return <><Auth onLoggedIn={()=>{setLoggedIn(true); setSession(true);}} toast={toast}/><ToastCenter toasts={toasts}/></>;

  return <>
    <main className="mx-auto min-h-screen w-full max-w-5xl px-3 pb-28 pt-3 sm:px-5 sm:pt-5 lg:px-7">
      <header className="mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[.24em] text-blue-600 sm:text-xs">ASAPLAB PH</div>
          <h1 className="mt-1 truncate text-[1.65rem] leading-none sm:text-3xl">CashFlow</h1>
          <p className="mt-1 text-[11px] text-slate-500 sm:text-xs">Offline cash-in, cash-out & finance tracker</p>
        </div>
        <button onClick={()=>{setSession(false); setLoggedIn(false); toast('Logged out successfully.');}} className="flex shrink-0 items-center gap-2 rounded-2xl bg-white px-3 py-2 text-xs font-medium text-slate-600 shadow-sm ring-1 ring-slate-200"><LogOut size={16}/> <span className="hidden xs:inline">Logout</span><span className="xs:hidden">Logout</span></button>
      </header>

      <nav className="mb-4 grid grid-cols-3 rounded-2xl bg-white p-1 shadow-sm ring-1 ring-slate-200">
        {(['TRANSACTION','RATES','FINANCE'] as Tab[]).map((t)=><button key={t} onClick={()=>setTab(t)} className={`rounded-xl px-1 py-3 text-[10px] font-medium transition sm:text-xs ${tab===t?'blue-gradient text-white shadow':'text-slate-500'}`}>{t}</button>)}
      </nav>

      {tab==='TRANSACTION' && <Transactions data={data} setData={setData} toast={toast}/>} 
      {tab==='RATES' && <Rates data={data} setData={setData} toast={toast}/>} 
      {tab==='FINANCE' && <Finance data={data} setData={setData} toast={toast}/>} 
    </main>
    <ToastCenter toasts={toasts}/>
  </>;
}

function Splash() {
  return <div className="fixed inset-0 grid place-items-center blue-gradient text-white">
    <div className="text-center">
      <div className="mx-auto mb-5 grid h-24 w-24 place-items-center rounded-[30px] bg-white/12 ring-1 ring-white/25 shadow-2xl"><div className="display-font text-5xl">A</div></div>
      <div className="display-font text-2xl">ASAPLAB PH</div>
      <div className="mt-2 text-xs font-medium uppercase tracking-[.25em] text-blue-100">CashFlow</div>
    </div>
  </div>
}

function Auth({onLoggedIn, toast}:{onLoggedIn:()=>void; toast:(m:string,k?:'success'|'error')=>void}) {
  const [user, setUser] = useState<any>(null);
  const [username,setUsername]=useState(''); const [password,setPassword]=useState(''); const [show,setShow]=useState(false);
  useEffect(()=>setUser(getLocalUser()),[]);
  const submit = async () => {
    if (!username.trim() || password.length<4) return toast('Enter username and at least 4 characters for password.','error');
    const passwordHash = await hashText(password);
    if (!user) {
      setLocalUser({username:username.trim(),passwordHash}); setUser({username:username.trim(),passwordHash}); onLoggedIn(); toast('Account created successfully.');
    } else if (user.username===username.trim() && user.passwordHash===passwordHash) { onLoggedIn(); toast('Successfully logged in.'); }
    else toast('Incorrect login details.','error');
  };
  return <main className="min-h-screen bg-[radial-gradient(circle_at_top,#dcecff_0,#f7fbff_44%,#eef3f9_100%)] px-4 py-8 sm:px-5 sm:py-10">
    <div className="mx-auto max-w-md pt-8 sm:pt-10">
      <div className="mb-8 text-center"><div className="display-font mx-auto mb-4 grid h-20 w-20 place-items-center rounded-[24px] blue-gradient text-3xl text-white shadow-xl shadow-blue-200">A</div><h1 className="text-2xl">ASAPLAB PH CashFlow</h1><p className="mt-2 text-sm text-slate-500">{user?'Sign in to your offline account':'Create your local offline account'}</p></div>
      <div className="rounded-[28px] bg-white p-5 card-shadow ring-1 ring-slate-200/70">
        <div className="space-y-4"><Field label="Username"><input className={inputClass} value={username} onChange={e=>setUsername(e.target.value)} placeholder="Your username"/></Field><Field label="Password"><div className="relative"><input type={show?'text':'password'} className={`${inputClass} pr-12`} value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••"/><button onClick={()=>setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-slate-400">{show?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></Field><button onClick={submit} className={`${btnPrimary} w-full`}>{user?'Login':'Create Account'}</button></div>
        <p className="mt-4 text-center text-[11px] leading-5 text-slate-400">This login is stored on this device only. Clearing browser data removes the account and local records.</p>
      </div>
    </div>
  </main>
}

function SummaryCard({label,value,icon}:{label:string; value:string; icon:React.ReactNode}) {
  return <div className="blue-gradient rounded-[26px] p-4 text-white shadow-xl shadow-blue-200/70 sm:p-5"><div className="mb-4 flex items-center justify-between"><div className="text-[11px] font-medium uppercase tracking-[.16em] text-blue-100 sm:text-xs">{label}</div><div className="rounded-2xl bg-white/12 p-2.5">{icon}</div></div><div className="display-font text-2xl tracking-tight sm:text-3xl">{value}</div></div>
}

function MetricCard({label,value,icon,tone='blue'}:{label:string; value:string; icon:React.ReactNode; tone?:'blue'|'indigo'|'slate'}) {
  const toneClass = tone==='blue'?'bg-blue-50 text-blue-700':tone==='indigo'?'bg-indigo-50 text-indigo-700':'bg-slate-50 text-slate-700';
  return <div className={`compact-card rounded-[22px] p-3.5 ring-1 ring-slate-200/70 ${toneClass}`}><div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wide opacity-80">{icon}{label}</div><div className="compact-value display-font mt-2 text-lg sm:text-xl">{value}</div></div>
}

function Transactions({data,setData,toast}:{data:AppData; setData:React.Dispatch<React.SetStateAction<AppData>>; toast:(m:string,k?:'success'|'error')=>void}) {
  const balances = getBalances(data);
  const [mode,setMode]=useState<'ALL'|'TODAY'|'MONTH'|'CUSTOM'>('ALL');
  const [typeFilter,setTypeFilter]=useState<TxFilter>('ALL');
  const [start,setStart]=useState(todayISO()); const [end,setEnd]=useState(todayISO()); const [open,setOpen]=useState(false);
  const [confirm,setConfirm]=useState(false); const [cameraOpen,setCameraOpen]=useState(false);
  const [form,setForm]=useState({date:todayISO(),type:'CASH_IN' as TxType,amount:'',fee:'',reference:''});
  const [manualFee,setManualFee]=useState(false); const [receipt,setReceipt]=useState<Blob|null>(null); const [receiptName,setReceiptName]=useState('');
  const galleryRef=useRef<HTMLInputElement>(null);

  const numericAmount=Number(form.amount)||0;
  const autoFee=calculateFee(numericAmount,form.type,data.rates);
  useEffect(()=>{ if(!manualFee) setForm(f=>({...f,fee:String(autoFee||'')})); },[autoFee,manualFee]);

  const filtered = useMemo(()=>data.transactions.filter(tx=>{
    const d=tx.date; const today=todayISO(); const month=today.slice(0,7);
    const dateOk = mode==='TODAY'?d===today:mode==='MONTH'?d.startsWith(month):mode==='CUSTOM'?d>=start&&d<=end:true;
    const typeOk = typeFilter==='ALL' || tx.type===typeFilter;
    return dateOk && typeOk;
  }).sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt)),[data.transactions,mode,typeFilter,start,end]);

  const reset=()=>{setForm({date:todayISO(),type:'CASH_IN',amount:'',fee:'',reference:''});setManualFee(false);setReceipt(null);setReceiptName('');};
  const closeAsk=()=>setConfirm(true);
  const process=async()=>{
    const amount=Number(form.amount), fee=Number(form.fee);
    if(!amount||amount<=0) return toast('Enter a valid amount.','error');
    if(fee<0||!Number.isFinite(fee)) return toast('Enter a valid fee.','error');
    const issue=validateTransaction(data,form.type,amount); if(issue) return toast(issue,'error');
    const id=uid('tx'); let receiptId:string|undefined;
    if(receipt){receiptId=`receipt_${id}`; try{await saveReceipt(receiptId,receipt);}catch{return toast('Could not save receipt image.','error');}}
    setData(d=>({...d,transactions:[...d.transactions,{id,date:form.date,type:form.type,account:'GCASH',amount,fee,autoFee,reference:form.reference.trim()||undefined,receiptId,createdAt:new Date().toISOString()}]}));
    setOpen(false);reset();toast('Transaction completed successfully.');
  };

  return <section className="space-y-4">
    <SummaryCard label="Total Revenue" value={money(totalRevenue(data))} icon={<BadgeDollarSign size={22}/>}/>

    <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
      <MetricCard label="Cash In Processed" value={money(totalCashInProcessed(data))} icon={<TrendingUp size={15}/>} tone="blue"/>
      <MetricCard label="Cash Out Processed" value={money(totalCashOutProcessed(data))} icon={<TrendingDown size={15}/>} tone="indigo"/>
    </div>

    <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
      <MetricCard label="Cash Balance" value={money(balances.CASH)} icon={<Banknote size={15}/>} tone="slate"/>
      <MetricCard label="GCash Balance" value={money(balances.GCASH)} icon={<WalletCards size={15}/>} tone="slate"/>
    </div>

    <div className="grid grid-cols-2 gap-2.5 sm:gap-3"><button onClick={()=>{reset();setForm(f=>({...f,type:'CASH_IN'}));setOpen(true)}} className="rounded-[22px] border border-blue-200 bg-blue-50 px-3 py-3.5 text-left sm:px-4 sm:py-4"><div className="text-[11px] font-medium text-blue-600 sm:text-xs">CASH IN</div><div className="mt-1 text-[12px] text-slate-700 sm:text-sm">Receive cash, send GCash</div></button><button onClick={()=>{reset();setForm(f=>({...f,type:'CASH_OUT'}));setOpen(true)}} className="rounded-[22px] border border-indigo-200 bg-indigo-50 px-3 py-3.5 text-left sm:px-4 sm:py-4"><div className="text-[11px] font-medium text-indigo-600 sm:text-xs">CASH OUT</div><div className="mt-1 text-[12px] text-slate-700 sm:text-sm">Pay cash, receive GCash</div></button></div>

    <div className="rounded-[26px] bg-white p-3.5 card-shadow ring-1 ring-slate-200/70 sm:p-4">
      <div className="mb-4 flex items-center justify-between"><div><h2 className="text-base">Transaction History</h2><p className="text-xs text-slate-400">{filtered.length} record{filtered.length===1?'':'s'}</p></div><CalendarDays size={20} className="text-blue-600"/></div>
      <div className="mb-2 grid grid-cols-4 gap-1.5 sm:gap-2">{(['ALL','TODAY','MONTH','CUSTOM'] as const).map(x=><button key={x} onClick={()=>setMode(x)} className={`rounded-xl px-1 py-2 text-[9px] font-medium sm:px-2 sm:text-[10px] ${mode===x?'bg-blue-600 text-white':'bg-slate-100 text-slate-500'}`}>{x==='MONTH'?'THIS MONTH':x}</button>)}</div>
      <div className="mb-3 grid grid-cols-3 gap-1.5 sm:gap-2">{(['ALL','CASH_IN','CASH_OUT'] as TxFilter[]).map(x=><button key={x} onClick={()=>setTypeFilter(x)} className={`rounded-xl px-2 py-2 text-[10px] font-medium ${typeFilter===x?'bg-slate-900 text-white':'bg-slate-50 text-slate-500 ring-1 ring-slate-100'}`}>{x==='ALL'?'ALL TYPES':x==='CASH_IN'?'CASH IN':'CASH OUT'}</button>)}</div>
      {mode==='CUSTOM'&&<div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2"><Field label="From"><input type="date" className={inputClass} value={start} onChange={e=>setStart(e.target.value)}/></Field><Field label="To"><input type="date" className={inputClass} value={end} onChange={e=>setEnd(e.target.value)}/></Field></div>}
      <div className="space-y-2">{filtered.length===0?<div className="rounded-2xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">No transactions found.</div>:filtered.map(tx=><TransactionRow key={tx.id} tx={tx} onViewReceipt={async()=>{if(!tx.receiptId)return;const blob=await getReceipt(tx.receiptId);if(blob){const url=URL.createObjectURL(blob);window.open(url,'_blank');setTimeout(()=>URL.revokeObjectURL(url),15000)}}}/>)}</div>
    </div>

    <button onClick={()=>{reset();setOpen(true)}} className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-4 z-30 grid h-14 w-14 place-items-center rounded-full blue-gradient text-white shadow-2xl shadow-blue-300 sm:right-6 sm:h-16 sm:w-16 lg:right-[calc(50%-470px)]"><Plus size={28}/></button>

    <Modal open={open} title="New Transaction" onClose={closeAsk}>
      <div className="space-y-4">
        <Field label="Date"><input type="date" className={inputClass} value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></Field>
        <Field label="Transaction Type"><div className="grid grid-cols-2 gap-2">{(['CASH_IN','CASH_OUT'] as TxType[]).map(t=><button key={t} onClick={()=>{setManualFee(false);setForm({...form,type:t})}} className={`rounded-2xl px-3 py-3 text-sm font-medium ${form.type===t?'blue-gradient text-white':'bg-slate-100 text-slate-600'}`}>{t==='CASH_IN'?'Cash In':'Cash Out'}</button>)}</div></Field>
        <Field label="Account"><div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700 ring-1 ring-slate-200">GCash</div></Field>
        <Field label="Amount"><input inputMode="decimal" className={inputClass} value={form.amount} onChange={e=>setForm({...form,amount:e.target.value.replace(/[^0-9.]/g,'')})} placeholder="0.00"/></Field>
        <Field label="Fee"><div className="relative"><input inputMode="decimal" className={`${inputClass} pr-28`} value={form.fee} onChange={e=>{setManualFee(true);setForm({...form,fee:e.target.value.replace(/[^0-9.]/g,'')})}} placeholder="Auto"/><button onClick={()=>{setManualFee(false);setForm(f=>({...f,fee:String(autoFee)}))}} className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1 rounded-xl bg-blue-50 px-2.5 py-2 text-[10px] font-medium text-blue-600"><RotateCcw size={13}/> AUTO</button></div><div className="mt-1 text-[11px] text-slate-400">Calculated fee: {money(autoFee)} · You can override it manually.</div></Field>
        <Field label="Reference # (optional)"><input className={inputClass} value={form.reference} onChange={e=>setForm({...form,reference:e.target.value})} placeholder="Reference number"/></Field>
        <div><div className="mb-2 text-xs font-medium text-slate-600">Receipt Image (optional)</div><div className="grid grid-cols-2 gap-3"><button onClick={()=>setCameraOpen(true)} className={btnGhost}><span className="flex items-center justify-center gap-2"><Camera size={18}/> Camera</span></button><button onClick={()=>galleryRef.current?.click()} className={btnGhost}><span className="flex items-center justify-center gap-2"><ImageIcon size={18}/> Gallery</span></button></div><input ref={galleryRef} hidden type="file" accept="image/*" onChange={e=>{const f=e.target.files?.[0];if(f){setReceipt(f);setReceiptName(f.name)}}}/>{receipt&&<div className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">Attached: {receiptName || 'Captured receipt'}</div>}</div>
        <div className="grid grid-cols-2 gap-3 pt-2"><button onClick={closeAsk} className={btnGhost}>Cancel</button><button onClick={process} className={btnPrimary}>Process</button></div>
      </div>
    </Modal>
    <CameraCapture open={cameraOpen} onClose={()=>setCameraOpen(false)} onCaptured={(blob)=>{setReceipt(blob);setReceiptName('Camera receipt.jpg');setCameraOpen(false);toast('Receipt captured successfully.')}}/>
    <Confirm open={confirm} message="Are you sure you want to cancel this transaction? Unsaved details will be lost." onNo={()=>setConfirm(false)} onYes={()=>{setConfirm(false);setOpen(false);reset();}}/>
  </section>
}

function CameraCapture({open,onClose,onCaptured}:{open:boolean;onClose:()=>void;onCaptured:(blob:Blob)=>void}) {
  const videoRef=useRef<HTMLVideoElement>(null); const streamRef=useRef<MediaStream|null>(null); const [error,setError]=useState('');
  useEffect(()=>{
    if(!open) return;
    let active=true;
    (async()=>{
      try {
        setError('');
        if(!navigator.mediaDevices?.getUserMedia) throw new Error('Camera access is not supported by this browser.');
        const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
        if(!active){stream.getTracks().forEach(t=>t.stop());return;}
        streamRef.current=stream;
        if(videoRef.current){videoRef.current.srcObject=stream;await videoRef.current.play();}
      } catch(e:any){setError(e?.message || 'Camera permission was denied.');}
    })();
    return ()=>{active=false;streamRef.current?.getTracks().forEach(t=>t.stop());streamRef.current=null;};
  },[open]);
  if(!open)return null;
  const capture=()=>{
    const v=videoRef.current;if(!v||!v.videoWidth)return;
    const c=document.createElement('canvas');c.width=v.videoWidth;c.height=v.videoHeight;const ctx=c.getContext('2d');if(!ctx)return;ctx.drawImage(v,0,0,c.width,c.height);c.toBlob(b=>{if(b)onCaptured(b)},'image/jpeg',0.9);
  };
  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/85 p-3">
    <div className="w-full max-w-md rounded-[26px] bg-white p-4 shadow-2xl">
      <div className="mb-3 flex items-center justify-between"><h2 className="text-lg">Capture Receipt</h2><button onClick={onClose} className="rounded-full bg-slate-100 p-2"><X size={18}/></button></div>
      {error?<div className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-700">{error}<div className="mt-2 text-xs text-rose-500">Use HTTPS on your phone and allow camera permission when asked.</div></div>:<video ref={videoRef} playsInline muted className="aspect-[3/4] w-full rounded-2xl bg-slate-900 object-cover"/>}
      <button onClick={capture} disabled={!!error} className={`${btnPrimary} mt-4 w-full`}><span className="flex items-center justify-center gap-2"><Camera size={18}/> Capture Receipt</span></button>
    </div>
  </div>
}

function TransactionRow({tx,onViewReceipt}:{tx:any;onViewReceipt:()=>void}) {
  return <div className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3">
    <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-lg px-2 py-1 text-[10px] font-medium ${tx.type==='CASH_IN'?'bg-blue-50 text-blue-700':'bg-indigo-50 text-indigo-700'}`}>{tx.type==='CASH_IN'?'IN':'OUT'}</span><span className="text-xs font-medium text-slate-500">GCASH</span><span className="text-xs text-slate-400">{tx.date}</span></div><div className="mt-2 text-sm font-medium">{money(tx.amount)} <span className="font-normal text-slate-400">+ {money(tx.fee)} fee</span></div>{tx.reference&&<div className="mt-1 truncate text-[11px] text-slate-400">Ref: {tx.reference}</div>}</div>
    {tx.receiptId&&<button onClick={onViewReceipt} className="rounded-xl bg-slate-100 p-2 text-slate-600"><ReceiptText size={17}/></button>}
  </div>
}

function Rates({data,setData,toast}:{data:AppData; setData:React.Dispatch<React.SetStateAction<AppData>>; toast:(m:string,k?:'success'|'error')=>void}) {
  const [open,setOpen]=useState(false); const [editing,setEditing]=useState<string|null>(null); const [confirm,setConfirm]=useState(false);
  const [form,setForm]=useState({min:'',max:'',fee:'',appliesTo:'BOTH' as 'BOTH'|TxType});
  const reset=()=>{setForm({min:'',max:'',fee:'',appliesTo:'BOTH'});setEditing(null)};
  const save=()=>{const min=Number(form.min),max=Number(form.max),fee=Number(form.fee);if(min<0||max<min||fee<0||!form.max||!form.fee)return toast('Check the rate range and fee.','error');const r={id:editing||uid('rate'),min,max,fee,appliesTo:form.appliesTo};setData(d=>({...d,rates:editing?d.rates.map(x=>x.id===editing?r:x):[...d.rates,r]}));setOpen(false);reset();toast(editing?'Rate updated successfully.':'Rate saved successfully.');};
  const edit=(r:any)=>{setEditing(r.id);setForm({min:String(r.min),max:String(r.max),fee:String(r.fee),appliesTo:r.appliesTo});setOpen(true)};
  return <section className="space-y-4">
    <div className="blue-gradient rounded-[26px] p-4 text-white shadow-xl shadow-blue-200/70 sm:p-5"><div className="text-[11px] font-medium uppercase tracking-[.16em] text-blue-100 sm:text-xs">Fee Rules</div><div className="display-font mt-2 text-2xl">Customizable Rates</div><p className="mt-2 max-w-lg text-sm leading-6 text-blue-100">Matching ranges are applied automatically. Above your highest range, the latest fee pattern continues. You can still override the fee per transaction.</p></div>
    <div className="rounded-[26px] bg-white p-4 card-shadow ring-1 ring-slate-200/70"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-base">Saved Rates</h2><p className="text-xs text-slate-400">Used for automatic fee calculation</p></div><button onClick={()=>{reset();setOpen(true)}} className="rounded-xl blue-gradient p-2.5 text-white"><Plus size={18}/></button></div><div className="space-y-2">{data.rates.length===0?<div className="rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-400">No rates saved.</div>:data.rates.slice().sort((a,b)=>a.min-b.min).map(r=><div key={r.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 p-3"><div className="min-w-0"><div className="text-sm font-medium">₱{r.min.toLocaleString()} – ₱{r.max.toLocaleString()}</div><div className="mt-1 text-xs text-slate-400">Fee {money(r.fee)} · {r.appliesTo==='BOTH'?'Cash In & Cash Out':r.appliesTo==='CASH_IN'?'Cash In':'Cash Out'}</div></div><div className="flex shrink-0 gap-1"><button onClick={()=>edit(r)} className="rounded-xl bg-slate-100 p-2"><Pencil size={15}/></button><button onClick={()=>{setData(d=>({...d,rates:d.rates.filter(x=>x.id!==r.id)}));toast('Rate deleted successfully.')}} className="rounded-xl bg-rose-50 p-2 text-rose-600"><Trash2 size={15}/></button></div></div>)}</div></div>
    <Modal open={open} title={editing?'Edit Rate':'New Rate'} onClose={()=>setConfirm(true)}><div className="space-y-4"><div className="grid grid-cols-2 gap-3"><Field label="From Amount"><input inputMode="decimal" className={inputClass} value={form.min} onChange={e=>setForm({...form,min:e.target.value.replace(/[^0-9.]/g,'')})} placeholder="10"/></Field><Field label="To Amount"><input inputMode="decimal" className={inputClass} value={form.max} onChange={e=>setForm({...form,max:e.target.value.replace(/[^0-9.]/g,'')})} placeholder="500"/></Field></div><Field label="Fee Amount"><input inputMode="decimal" className={inputClass} value={form.fee} onChange={e=>setForm({...form,fee:e.target.value.replace(/[^0-9.]/g,'')})} placeholder="10"/></Field><Field label="Applies To"><select className={inputClass} value={form.appliesTo} onChange={e=>setForm({...form,appliesTo:e.target.value as any})}><option value="BOTH">Cash In & Cash Out</option><option value="CASH_IN">Cash In only</option><option value="CASH_OUT">Cash Out only</option></select></Field><div className="grid grid-cols-2 gap-3"><button onClick={()=>setConfirm(true)} className={btnGhost}>Cancel</button><button onClick={save} className={btnPrimary}>Save Rate</button></div></div></Modal>
    <Confirm open={confirm} message="Are you sure you want to cancel? Unsaved rate details will be lost." onNo={()=>setConfirm(false)} onYes={()=>{setConfirm(false);setOpen(false);reset()}}/>
  </section>
}

function Finance({data,setData,toast}:{data:AppData; setData:React.Dispatch<React.SetStateAction<AppData>>; toast:(m:string,k?:'success'|'error')=>void}) {
  const balances=getBalances(data); const [open,setOpen]=useState(false); const [kind,setKind]=useState<FinanceType>('CAPITAL'); const [confirm,setConfirm]=useState(false);
  const [form,setForm]=useState({date:todayISO(),amount:'',account:'CASH' as Account,fromAccount:'CASH' as Account,toAccount:'GCASH' as Account,note:''});
  const reset=(k:FinanceType='CAPITAL')=>{setKind(k);setForm({date:todayISO(),amount:'',account:'CASH',fromAccount:'CASH',toAccount:'GCASH',note:''})};
  const save=()=>{const amount=Number(form.amount);if(!amount||amount<=0)return toast('Enter a valid amount.','error');if(kind==='WITHDRAWAL'&&balances[form.account]<amount)return toast(`Not enough ${form.account} balance.`,'error');if(kind==='TRANSFER'){if(form.fromAccount===form.toAccount)return toast('Choose two different accounts.','error');if(balances[form.fromAccount]<amount)return toast(`Not enough ${form.fromAccount} balance.`,'error');}
    const item:any={id:uid('fin'),date:form.date,type:kind,amount,note:form.note.trim()||undefined,createdAt:new Date().toISOString()}; if(kind==='TRANSFER'){item.fromAccount=form.fromAccount;item.toAccount=form.toAccount}else item.account=form.account; setData(d=>({...d,finance:[...d.finance,item]}));setOpen(false);reset();toast(`${kind==='CAPITAL'?'Capital':kind==='WITHDRAWAL'?'Withdrawal':'Transfer'} added successfully.`)};

  const capitalHistory=data.finance.filter(x=>x.type==='CAPITAL').sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt));
  const withdrawalHistory=data.finance.filter(x=>x.type==='WITHDRAWAL').sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt));
  const transferHistory=data.finance.filter(x=>x.type==='TRANSFER').sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt));

  return <section className="space-y-4">
    <SummaryCard label="Total Capital Added" value={money(totalCapital(data))} icon={<WalletCards size={22}/>}/>
    <MetricCard label="Total Withdrawals" value={money(totalWithdrawals(data))} icon={<TrendingDown size={15}/>} tone="slate"/>
    <div className="rounded-[26px] bg-white p-4 card-shadow ring-1 ring-slate-200/70"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-base">Account Balances</h2><p className="text-xs text-slate-400">Updated from finance entries and transactions</p></div><button onClick={()=>{reset('CAPITAL');setOpen(true)}} className="rounded-xl blue-gradient p-2.5 text-white"><Plus size={18}/></button></div><div className="grid grid-cols-2 gap-2.5 sm:gap-3">{([{k:'CASH',i:<Banknote size={18}/>},{k:'GCASH',i:<WalletCards size={18}/>} ] as any[]).map(x=><div key={x.k} className="rounded-2xl bg-slate-50 p-3.5"><div className="flex items-center gap-2 text-xs font-medium text-slate-500">{x.i}{x.k}</div><div className="display-font mt-3 break-words text-base sm:text-lg">{money(balances[x.k as Account])}</div></div>)}</div></div>
    <div className="grid grid-cols-3 gap-1.5 sm:gap-2"><button onClick={()=>{reset('CAPITAL');setOpen(true)}} className="rounded-2xl bg-blue-50 p-3 text-[10px] font-medium text-blue-700 sm:text-xs">+ Capital</button><button onClick={()=>{reset('WITHDRAWAL');setOpen(true)}} className="rounded-2xl bg-rose-50 p-3 text-[10px] font-medium text-rose-700 sm:text-xs">− Withdrawal</button><button onClick={()=>{reset('TRANSFER');setOpen(true)}} className="rounded-2xl bg-indigo-50 p-3 text-[10px] font-medium text-indigo-700 sm:text-xs">⇄ Transfer</button></div>

    <HistorySection title="Capital History" empty="No capital entries yet." items={capitalHistory}/>
    <HistorySection title="Withdrawal History" empty="No withdrawal entries yet." items={withdrawalHistory}/>
    {transferHistory.length>0&&<HistorySection title="Transfer History" empty="No transfer entries yet." items={transferHistory}/>} 

    <Modal open={open} title={kind==='CAPITAL'?'Add Capital':kind==='WITHDRAWAL'?'Add Withdrawal':'Transfer Funds'} onClose={()=>setConfirm(true)}><div className="space-y-4"><Field label="Date"><input type="date" className={inputClass} value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></Field><Field label="Amount"><input inputMode="decimal" className={inputClass} value={form.amount} onChange={e=>setForm({...form,amount:e.target.value.replace(/[^0-9.]/g,'')})} placeholder="0.00"/></Field>{kind==='TRANSFER'?<div className="grid grid-cols-2 gap-3"><Field label="From Account"><select className={inputClass} value={form.fromAccount} onChange={e=>setForm({...form,fromAccount:e.target.value as Account})}><option value="CASH">Cash</option><option value="GCASH">GCash</option></select></Field><Field label="To Account"><select className={inputClass} value={form.toAccount} onChange={e=>setForm({...form,toAccount:e.target.value as Account})}><option value="CASH">Cash</option><option value="GCASH">GCash</option></select></Field></div>:<Field label="Account"><select className={inputClass} value={form.account} onChange={e=>setForm({...form,account:e.target.value as Account})}><option value="CASH">Cash</option><option value="GCASH">GCash</option></select></Field>}<Field label="Note (optional)"><input className={inputClass} value={form.note} onChange={e=>setForm({...form,note:e.target.value})} placeholder="Optional note"/></Field><div className="grid grid-cols-2 gap-3"><button onClick={()=>setConfirm(true)} className={btnGhost}>Cancel</button><button onClick={save} className={btnPrimary}>Save {kind==='CAPITAL'?'Capital':kind==='WITHDRAWAL'?'Withdrawal':'Transfer'}</button></div></div></Modal>
    <Confirm open={confirm} message="Are you sure you want to cancel? Unsaved finance details will be lost." onNo={()=>setConfirm(false)} onYes={()=>{setConfirm(false);setOpen(false);reset()}}/>
  </section>
}

function HistorySection({title,empty,items}:{title:string;empty:string;items:any[]}) {
  return <div className="rounded-[26px] bg-white p-4 card-shadow ring-1 ring-slate-200/70"><h2 className="mb-3 text-base">{title}</h2><div className="space-y-2">{items.length===0?<div className="rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-400">{empty}</div>:items.map(x=><div key={x.id} className="flex items-center justify-between rounded-2xl border border-slate-100 p-3"><div className="min-w-0"><div className="text-xs font-medium text-slate-500">{x.type} · {x.date}</div><div className="display-font mt-1 text-sm">{money(x.amount)}</div><div className="mt-1 truncate text-[11px] text-slate-400">{x.type==='TRANSFER'?`${x.fromAccount} → ${x.toAccount}`:x.account}{x.note?` · ${x.note}`:''}</div></div><ChevronRight size={16} className="shrink-0 text-slate-300"/></div>)}</div></div>
}
