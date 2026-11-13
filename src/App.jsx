import { useState, useEffect, useMemo } from 'react'
import { supabase } from './supabase.js'
import { statutExp, statutActivite } from './status.js'

const Tag = ({ s }) => <span className={`tag ${s.cls}`}>{s.label}</span>
const fmt = (d) => d ? d.split('-').reverse().join('/') : '—'
const normalize = (v) => (v ?? '').toString().trim()
const FIRST_ADMIN_EMAIL = 'gradismith66@gmail.com'
const VIDE = { nom: '', type: 'MENAGE', numAut: '', dateAut: '', expAut: '', dateAgr: '', expAgr: '', contact: '', tel: '', email: '', adresse: '', communes: '', quartiers: '', statutJuridique: '', source: 'saisie manuelle', note: '' }

const toPme = (p) => ({
  id: p.id, nom: p.nom, type: p.type, numAut: p.num_aut, dateAut: p.date_aut || '', expAut: p.exp_aut || '',
  dateAgr: p.date_agr || '', expAgr: p.exp_agr || '', contact: p.contact, fonction: p.fonction, tel: p.tel,
  email: p.email, adresse: p.adresse, communes: p.communes, quartiers: p.quartiers,
  statutJuridique: p.statut_juridique, source: p.source, nbAutorisations: p.nb_autorisations, note: p.note,
})
const toAchat = (a) => ({ id: a.id, pmeId: a.pme_id, date: a.date, qte: a.qte, detail: a.detail || [] })
const pmePayload = (p) => ({
  nom: p.nom.trim(), type: p.type || '', num_aut: p.numAut || '', date_aut: p.dateAut || null, exp_aut: p.expAut || null,
  date_agr: p.dateAgr || null, exp_agr: p.expAgr || null, contact: p.contact || '', fonction: p.fonction || '',
  tel: p.tel || '', email: p.email || '', adresse: p.adresse || '', communes: p.communes || '', quartiers: p.quartiers || '',
  statut_juridique: p.statutJuridique || '', source: p.source || '', nb_autorisations: Number(p.nbAutorisations ?? 1), note: p.note || '',
})
const fetchAll = async (table, orderColumn, ascending = true) => {
  const all = []
  let offset = 0
  let total = 0
  do {
    const { data, error, count } = await supabase.from(table).select('*', { count: 'exact' })
      .order(orderColumn, { ascending }).range(offset, offset + 499)
    if (error) throw error
    all.push(...data)
    total = count ?? all.length
    if (!data.length) break
    offset += data.length
  } while (offset < total)
  return all
}

export default function App() {
  const [session, setSession] = useState(undefined)
  const [role, setRole] = useState(null)
  const [dataReady, setDataReady] = useState(false)
  const [bootstrapAvailable, setBootstrapAvailable] = useState(null)
  const [authBusy, setAuthBusy] = useState(false)
  const [authNotice, setAuthNotice] = useState('')
  const [passwordRecovery, setPasswordRecovery] = useState(false)
  const [pmes, setPmes] = useState([])
  const [achats, setAchats] = useState([])
  const [cfg, setCfg] = useState({ alerte: 30, inactif: 90 })
  const [notice, setNotice] = useState('')
  const [tab, setTab] = useState('dash')
  const [q, setQ] = useState('')
  const [fType, setFType] = useState('')
  const [fCommune, setFCommune] = useState('')
  const [fStatAut, setFStatAut] = useState('')
  const [fStatMin, setFStatMin] = useState('')
  const [fYear, setFYear] = useState('')
  const [fTransaction, setFTransaction] = useState('')
  const [fRenewal, setFRenewal] = useState('')
  const [fIncomplete, setFIncomplete] = useState(false)
  const [edit, setEdit] = useState(null)
  const [achatFor, setAchatFor] = useState(null)
  const [detail, setDetail] = useState(null)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    supabase.rpc('admin_bootstrap_available').then(({ data, error }) => {
      if (!error) setBootstrapAvailable(Boolean(data))
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true)
      setSession(nextSession)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!supabase || session === undefined) return
    let cancelled = false
    setDataReady(false); setRole(null); setNotice('')
    const load = async () => {
      if (!session) {
        setPmes([]); setAchats([]); setDataReady(true)
        return
      }

      let { data: staff, error: staffError } = await supabase.from('staff_profiles').select('role').eq('user_id', session.user.id).maybeSingle()
      if (staffError) throw staffError
      if (!staff && session.user.email?.toLowerCase() === FIRST_ADMIN_EMAIL) {
        const { data: canBootstrap, error: bootstrapCheckError } = await supabase.rpc('admin_bootstrap_available')
        if (bootstrapCheckError) throw bootstrapCheckError
        setBootstrapAvailable(Boolean(canBootstrap))
        if (canBootstrap) {
          const { error: bootstrapError } = await supabase.rpc('bootstrap_first_admin')
          if (bootstrapError) throw bootstrapError
          const result = await supabase.from('staff_profiles').select('role').eq('user_id', session.user.id).single()
          staff = result.data
          staffError = result.error
          if (staffError) throw staffError
          setBootstrapAvailable(false)
        }
      }
      const nextRole = staff?.role ?? null
      if (!nextRole) {
        if (cancelled) return
        setRole(null); setPmes([]); setAchats([]); setDataReady(true)
        return
      }
      const [pmeRows, achatRows, settingsResult] = await Promise.all([
        fetchAll('pmes', 'id'),
        fetchAll('achats', 'date', false),
        supabase.from('settings').select('alerte, inactif').eq('id', true).single(),
      ])
      if (settingsResult.error) throw settingsResult.error
      if (cancelled) return
      setRole(nextRole); setPmes(pmeRows.map(toPme)); setAchats(achatRows.map(toAchat)); setCfg(settingsResult.data); setDataReady(true)
    }
    load().catch(error => { if (!cancelled) { setAuthNotice(error.message); setNotice(`Impossible de charger le registre : ${error.message}`); setDataReady(true) } })
    return () => { cancelled = true }
  }, [session])

  const signIn = async ({ email, password }) => {
    setAuthBusy(true); setAuthNotice('')
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) setAuthNotice(error.message)
    setAuthBusy(false)
  }
  const createFirstAdmin = async ({ password }) => {
    setAuthBusy(true); setAuthNotice('')
    const { data, error } = await supabase.auth.signUp({
      email: FIRST_ADMIN_EMAIL,
      password,
      options: { emailRedirectTo: window.location.origin },
    })
    if (error) {
      const message = error.message.toLowerCase()
      setAuthNotice(message.includes('already registered') || message.includes('already exists')
        ? `Le compte ${FIRST_ADMIN_EMAIL} existe déjà. Retourne à la connexion; après connexion, son rôle admin sera activé.`
        : error.message)
    }
    else if (data.session) setAuthNotice('Compte créé. Vérification et attribution du rôle administrateur en cours…')
    else setAuthNotice(`Un lien de vérification a été envoyé à ${FIRST_ADMIN_EMAIL}. Ouvre-le pour terminer la création du compte admin.`)
    setAuthBusy(false)
  }
  const resetPassword = async ({ email }) => {
    setAuthBusy(true); setAuthNotice('')
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin })
    setAuthNotice(error ? error.message : 'Si un compte existe pour cette adresse, un lien de réinitialisation a été envoyé.')
    setAuthBusy(false)
  }
  const saveNewPassword = async ({ password }) => {
    setAuthBusy(true); setAuthNotice('')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) setAuthNotice(error.message)
    else setPasswordRecovery(false)
    setAuthBusy(false)
  }
  const signOut = async () => {
    setAuthNotice('')
    await supabase.auth.signOut()
  }

  const canEdit = role === 'admin' || role === 'agent'
  const isAdmin = role === 'admin'
  const reportError = (error) => setNotice(`Opération impossible : ${error.message}`)

  const rows = useMemo(() => pmes.map(p => {
    const mine = achats.filter(a => a.pmeId === p.id).sort((a, b) => b.date.localeCompare(a.date))
    const dernier = mine[0]?.date || ''
    const totalSacs = mine.reduce((s, a) => s + Number(a.qte || 0), 0)
    const sAut = statutExp(p.expAut, cfg.alerte)
    const sAgr = statutExp(p.expAgr, cfg.alerte)
    const sAct = statutActivite(dernier, cfg.inactif)
    const transaction = (Number(p.nbAutorisations || 1) > 1 || normalize(p.source).toLowerCase().includes('renouv')) ? 'Renouvellement' : 'Nouvelle autorisation'
    const year = (p.dateAut || p.expAut || '').slice(0, 4)
    const isIncomplete = !p.nom || !p.type || !p.numAut || !p.dateAut || !p.expAut || !p.adresse || !p.tel
    const communes = normalize(p.communes).split(/[;,]/).map(v => v.trim()).filter(Boolean)

    return { ...p, mine, dernier, totalSacs, sAut, sAgr, sAct, transaction, year, isIncomplete, communes }
  }), [pmes, achats, cfg])

  const communeOptions = useMemo(() => Array.from(new Set(rows.flatMap(r => r.communes))).sort(), [rows])
  const yearOptions = useMemo(() => Array.from(new Set(rows.map(r => r.year).filter(Boolean))).sort((a, b) => b.localeCompare(a)), [rows])

  const filtered = rows.filter(r =>
    (!q || [r.nom, r.contact, r.numAut, r.adresse, r.tel].join(' ').toLowerCase().includes(q.toLowerCase())) &&
    (!fType || r.type === fType) &&
    (!fCommune || r.communes.some(c => c.toLowerCase().includes(fCommune.toLowerCase()))) &&
    (!fStatAut || r.sAut.label === fStatAut) &&
    (!fStatMin || r.sAgr.label === fStatMin) &&
    (!fYear || r.year === fYear) &&
    (!fTransaction || r.transaction === fTransaction) &&
    (!fRenewal || (fRenewal === 'oui' ? r.transaction === 'Renouvellement' : r.transaction !== 'Renouvellement')) &&
    (!fIncomplete || r.isIncomplete))

  const count = (f) => rows.filter(f).length
  const savePme = async (p) => {
    const result = p.id
      ? await supabase.from('pmes').update(pmePayload(p)).eq('id', p.id).select().single()
      : await supabase.from('pmes').insert(pmePayload(p)).select().single()
    if (result.error) { reportError(result.error); return }
    const saved = toPme(result.data)
    setPmes(current => p.id ? current.map(x => x.id === p.id ? saved : x) : [...current, saved]); setEdit(null); setNotice('')
  }
  const delPme = async (id) => {
    if (!isAdmin || !confirm('Supprimer cette PME et ses achats ?')) return
    const { error } = await supabase.from('pmes').delete().eq('id', id)
    if (error) { reportError(error); return }
    setPmes(current => current.filter(p => p.id !== id)); setAchats(current => current.filter(a => a.pmeId !== id)); setDetail(null)
  }
  const saveAchat = async (a) => {
    const { data, error } = await supabase.from('achats').insert({ pme_id: a.pmeId, date: a.date, qte: Number(a.qte), detail: a.detail || [] }).select().single()
    if (error) { reportError(error); return }
    setAchats(current => [...current, toAchat(data)]); setAchatFor(null); setNotice('')
  }
  const delAchat = async (id) => {
    if (!isAdmin) return
    const { error } = await supabase.from('achats').delete().eq('id', id)
    if (error) { reportError(error); return }
    setAchats(current => current.filter(a => a.id !== id))
  }
  const saveSettings = async (next) => {
    setCfg(next)
    const { error } = await supabase.from('settings').update(next).eq('id', true)
    if (error) reportError(error)
  }

  if (!supabase) return <Gate title="Configuration requise">Ajoute VITE_SUPABASE_URL et VITE_SUPABASE_PUBLISHABLE_KEY aux variables d’environnement.</Gate>
  if (session === undefined) return <Gate title="Connexion à REGEDEK PME">Chargement de la session…</Gate>
  if (session && passwordRecovery) return <PasswordRecovery busy={authBusy} notice={authNotice} onSave={saveNewPassword} />
  if (!session) return <AuthScreen bootstrapAvailable={bootstrapAvailable} busy={authBusy} notice={authNotice} onSignIn={signIn} onCreateFirstAdmin={createFirstAdmin} onResetPassword={resetPassword} />
  if (!dataReady) return <Gate title="Chargement du registre">Vérification de ton accès et récupération des données…</Gate>
  if (!role) return <AccessDenied notice={authNotice} onSignOut={signOut} />

  const exportCsv = () => {
    const h = ['Entreprise','Catégorie','Numéro autorisation','Date autorisation','Expiration autorisation','Statut REGEDEK','Date agrément','Expiration agrément','Statut ministériel','Téléphone','Adresse','Communes','Dernier achat','Total sacs','Activité']
    const l = filtered.map(r => [r.nom, r.type, r.numAut, r.dateAut, r.expAut, r.sAut.label, r.dateAgr, r.expAgr, r.sAgr.label, r.tel, r.adresse, r.communes.join('; '), r.dernier, r.totalSacs, r.sAct.label])
    const csv = [h, ...l].map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv' })); a.download = 'pme_autorisees_regedek.csv'; a.click()
  }

  const go = (stat, field = 'fStatAut') => {
    if (field === 'fStatAut') setFStatAut(stat)
    if (field === 'fStatMin') setFStatMin(stat)
    setTab('pme')
  }

  return (<>
    <header>
      <Brand compact />
      <nav>
        {[['dash', 'Tableau de bord'], ['pme', 'PME AUTORISÉES'], ['achats', 'Achats'], ['cfg', 'Réglages']].map(([k, l]) =>
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => { setTab(k); if (k !== 'pme') { setFStatAut(''); setFStatMin('') } }}>{l}</button>)}
      </nav>
      <button className="btn sec sign-out" onClick={signOut}>Se déconnecter</button>
    </header>
    <main>
      {notice && <p role="alert" className="notice">{notice}</p>}
      {tab === 'dash' && <>
        <div className="cards">
          <div className="card" onClick={() => go('')}><b>{rows.length}</b><span>Entreprises enregistrées</span></div>
          <div className="card" onClick={() => go('Valide')}><b>{count(r => r.sAut.label === 'Valide')}</b><span>Autorisations REGEDEK en cours</span></div>
          <div className="card" onClick={() => go('Expiré')}><b>{count(r => r.sAut.label === 'Expiré')}</b><span>Autorisations REGEDEK expirées</span></div>
          <div className="card" onClick={() => go('À renouveler')}><b>{count(r => r.sAut.label === 'À renouveler')}</b><span>Autorisations à renouveler</span></div>
          <div className="card" onClick={() => go('Valide', 'fStatMin')}><b>{count(r => r.sAgr.label === 'Valide')}</b><span>Agréments ministériels valides</span></div>
          <div className="card" onClick={() => go('Expiré', 'fStatMin')}><b>{count(r => r.sAgr.label === 'Expiré')}</b><span>Agréments ministériels expirés</span></div>
          <div className="card" onClick={() => setFIncomplete(true) || setTab('pme')}><b>{count(r => r.isIncomplete || r.sAut.label === 'À vérifier' || r.sAgr.label === 'À vérifier')}</b><span>Dossiers incomplets ou à vérifier</span></div>
        </div>
        <h2>À surveiller</h2>
        <Table rows={rows.filter(r => r.sAut.label !== 'Valide' || r.sAgr.label !== 'Valide' || r.isIncomplete || r.sAct.label !== 'Active')} onOpen={setDetail} canEdit={canEdit} isAdmin={isAdmin} />
      </>}

      {tab === 'pme' && <>
        <div className="bar filters">
          <input placeholder="Recherche par entreprise, numéro ou téléphone" value={q} onChange={e => setQ(e.target.value)} />
          <select value={fType} onChange={e => setFType(e.target.value)}>
            <option value="">Catégorie</option>
            {[...new Set(rows.map(r => r.type).filter(Boolean))].sort().map(v => <option key={v} value={v}>{v}</option>)}
          </select>
          <select value={fCommune} onChange={e => setFCommune(e.target.value)}>
            <option value="">Commune</option>
            {communeOptions.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
          <select value={fStatAut} onChange={e => setFStatAut(e.target.value)}>
            <option value="">Statut REGEDEK</option>
            {['Valide', 'À renouveler', 'Expiré', 'Non renseigné', 'À vérifier'].map(s => <option key={s}>{s}</option>)}
          </select>
          <select value={fStatMin} onChange={e => setFStatMin(e.target.value)}>
            <option value="">Statut ministériel</option>
            {['Valide', 'À renouveler', 'Expiré', 'Non renseigné', 'À vérifier'].map(s => <option key={s}>{s}</option>)}
          </select>
          <select value={fYear} onChange={e => setFYear(e.target.value)}>
            <option value="">Année</option>
            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={fTransaction} onChange={e => setFTransaction(e.target.value)}>
            <option value="">Type de transaction</option>
            {['Nouvelle autorisation', 'Renouvellement'].map(v => <option key={v}>{v}</option>)}
          </select>
          <select value={fRenewal} onChange={e => setFRenewal(e.target.value)}>
            <option value="">Renouvellements</option>
            <option value="oui">Oui</option>
            <option value="non">Non</option>
          </select>
          <label className="check"><input type="checkbox" checked={fIncomplete} onChange={e => setFIncomplete(e.target.checked)} /> Dossiers incomplets</label>
          {canEdit && <button className="btn" onClick={() => setEdit({ ...VIDE })}>+ Nouvelle PME</button>}
          <button className="btn sec" onClick={exportCsv}>Exporter CSV</button>
        </div>
        <Table rows={filtered} onOpen={setDetail} canEdit={canEdit} isAdmin={isAdmin} />
      </>}

      {tab === 'achats' && <>
        <div className="bar">{canEdit && <button className="btn" onClick={() => setAchatFor({ pmeId: pmes[0]?.id, date: new Date().toISOString().slice(0, 10), qte: '' })}>+ Enregistrer un achat</button>}</div>
        <div className="tw"><table><thead><tr><th>Date</th><th>PME</th><th>Quantité</th><th></th></tr></thead><tbody>
          {[...achats].sort((a, b) => b.date.localeCompare(a.date)).map(a => <tr key={a.id}>
            <td>{fmt(a.date)}</td><td>{pmes.find(p => p.id === a.pmeId)?.nom || '?'}</td><td>{Number(a.qte).toLocaleString('fr')}</td>
            <td>{isAdmin && <button className="btn sec" onClick={() => delAchat(a.id)}>Suppr.</button>}</td></tr>)}
        </tbody></table></div>
      </>}

      {tab === 'cfg' && <div className="box" style={{ margin: 0 }}>
        <h2>Règles de statut</h2>
        <div className="grid">
          <div><label>Alerte « À renouveler » (jours avant expiration)</label><input type="number" value={cfg.alerte} disabled={!isAdmin} onChange={e => saveSettings({ ...cfg, alerte: +e.target.value })} /></div>
          <div><label>PME « Inactive » après (jours sans achat)</label><input type="number" value={cfg.inactif} disabled={!isAdmin} onChange={e => saveSettings({ ...cfg, inactif: +e.target.value })} /></div>
        </div>
        {!isAdmin && <p>Seul un administrateur peut modifier ces règles.</p>}
      </div>}
    </main>

    {edit && <PmeForm p={edit} onSave={savePme} onClose={() => setEdit(null)} />}
    {achatFor && <AchatForm a={achatFor} pmes={pmes} onSave={saveAchat} onClose={() => setAchatFor(null)} />}
    {detail && (() => { const r = rows.find(x => x.id === detail.id); if (!r) return null; return (
      <div className="modal" onClick={() => setDetail(null)}><div className="box detail" onClick={e => e.stopPropagation()}>
        <h2>{r.nom} <small>({r.type || '—'})</small></h2>
        <p><strong>Contact :</strong> {r.contact || '—'} · <strong>Tél :</strong> {r.tel || '—'} · <strong>E-mail :</strong> {r.email || '—'}<br />
          <strong>Adresse :</strong> {r.adresse || '—'}<br />
          <strong>Communes :</strong> {r.communes.join(', ') || '—'}<br />
          <strong>Quartiers :</strong> {r.quartiers || '—'}<br />
          <strong>Statut juridique :</strong> {r.statutJuridique || '—'} · <strong>Source :</strong> {r.source || '—'}{r.note && <><br /><b>⚠ {r.note}</b></>}</p>
        <p><strong>Autorisation REGEDEK :</strong> {r.numAut || '—'} · {fmt(r.dateAut)} → {fmt(r.expAut)} <Tag s={r.sAut} /><br />
          <strong>Agrément ministère :</strong> {fmt(r.dateAgr)} → {fmt(r.expAgr)} <Tag s={r.sAgr} /><br />
          <strong>Transaction :</strong> {r.transaction} · <strong>Historique :</strong> {r.nbAutorisations || 1} enregistrement(s)<br />
          <strong>Activité :</strong> <Tag s={r.sAct} /> {r.sAct.jours !== null && `(dernier achat il y a ${r.sAct.jours} j)`}
        </p>
        <h2 className="subhead">Achats ({r.totalSacs.toLocaleString('fr')} sacs)</h2>
        {r.mine.length ? <ul>{r.mine.map(a => <li key={a.id}>{fmt(a.date)} : {Number(a.qte).toLocaleString('fr')} sacs</li>)}</ul> : <p>Aucun achat.</p>}
        <div className="row">
          {isAdmin && <button className="btn red" onClick={() => delPme(r.id)}>Supprimer</button>}
          {canEdit && <button className="btn sec" onClick={() => { setDetail(null); setAchatFor({ pmeId: r.id, date: new Date().toISOString().slice(0, 10), qte: '' }) }}>+ Achat</button>}
          {canEdit && <button className="btn" onClick={() => { setDetail(null); setEdit(pmes.find(p => p.id === r.id)) }}>Modifier</button>}
        </div>
      </div></div>) })()}
  </>)
}

function Brand({ compact = false }) {
  return <div className={`brand-lockup${compact ? ' brand-lockup-compact' : ''}`}>
    <span className="brand-mark"><img src="/favicon.png" alt="Logo REGEDEK" /></span>
    <span className="brand-copy"><strong>REGEDEK PME</strong><span>Gestion des PME autorisées</span></span>
  </div>
}

function Gate({ title, children }) {
  return <main className="gate"><section className="box"><h2>{title}</h2><p>{children}</p></section></main>
}

function AuthScreen({ bootstrapAvailable, busy, notice, onSignIn, onCreateFirstAdmin, onResetPassword }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const setup = mode === 'setup'
  const reset = mode === 'reset'
  const submit = async (event) => {
    event.preventDefault()
    setConfirmation('')
    if (setup && password.length < 8) { setConfirmation('Le mot de passe doit contenir au moins 8 caractères.'); return }
    if (reset) return onResetPassword({ email })
    if (setup) return onCreateFirstAdmin({ password })
    return onSignIn({ email, password })
  }
  return <main className="auth-page">
    <section className="auth-card">
      <Brand />
      <div className="auth-heading">
        <span className="eyebrow">ESPACE DU PERSONNEL</span>
        <h1>{setup ? 'Créer le premier compte admin' : reset ? 'Réinitialiser le mot de passe' : 'Connexion sécurisée'}</h1>
        <p>{setup ? 'Cette initialisation est disponible une seule fois et réservée à l’adresse autorisée.' : 'Connecte-toi avec le compte du personnel REGEDEK.'}</p>
      </div>
      {notice && <p className="auth-notice" role="status">{notice}</p>}
      {confirmation && <p className="auth-notice" role="alert">{confirmation}</p>}
      <form className="auth-form" onSubmit={submit}>
        {setup ? <div className="full"><label>Adresse autorisée</label><input type="email" value={FIRST_ADMIN_EMAIL} readOnly /></div> : <div className="full"><label htmlFor="auth-email">Adresse e-mail</label><input id="auth-email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required /></div>}
        {!reset && <div className="full"><label htmlFor="auth-password">Mot de passe</label><input id="auth-password" type="password" autoComplete={setup ? 'new-password' : 'current-password'} minLength={setup ? 8 : undefined} value={password} onChange={e => setPassword(e.target.value)} required /></div>}
        <button className="btn auth-submit" type="submit" disabled={busy || (bootstrapAvailable === null && setup)}>{busy ? 'Patiente…' : setup ? 'Créer le compte administrateur' : reset ? 'Envoyer le lien' : 'Se connecter'}</button>
      </form>
      <div className="auth-links">
        {mode === 'login' && <button className="text-button" type="button" onClick={() => setMode('reset')}>Mot de passe oublié ?</button>}
        {mode !== 'login' && <button className="text-button" type="button" onClick={() => setMode('login')}>Retour à la connexion</button>}
        {bootstrapAvailable && mode === 'login' && <button className="text-button" type="button" onClick={() => setMode('setup')}>Initialiser le premier compte admin</button>}
      </div>
      <p className="auth-footnote">L’accès au registre est réservé aux comptes autorisés.</p>
    </section>
  </main>
}

function AccessDenied({ notice, onSignOut }) {
  return <main className="gate"><section className="box access-denied">
    <Brand />
    <h2>Accès non autorisé</h2>
    <p>Ce compte n’a pas de profil dans le personnel REGEDEK. Contacte un administrateur pour obtenir l’accès.</p>
    {notice && <p className="auth-notice" role="alert">{notice}</p>}
    <button className="btn" onClick={onSignOut}>Se déconnecter</button>
  </section></main>
}

function PasswordRecovery({ busy, notice, onSave }) {
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const submit = (event) => {
    event.preventDefault()
    if (password.length < 8) { setConfirmation('Le mot de passe doit contenir au moins 8 caractères.'); return }
    setConfirmation('')
    onSave({ password })
  }
  return <main className="auth-page"><section className="auth-card">
    <Brand />
    <div className="auth-heading"><span className="eyebrow">SÉCURITÉ DU COMPTE</span><h1>Nouveau mot de passe</h1><p>Choisis un mot de passe d’au moins 8 caractères.</p></div>
    {notice && <p className="auth-notice" role="alert">{notice}</p>}
    {confirmation && <p className="auth-notice" role="alert">{confirmation}</p>}
    <form className="auth-form" onSubmit={submit}>
      <div className="full"><label htmlFor="new-password">Nouveau mot de passe</label><input id="new-password" type="password" autoComplete="new-password" minLength={8} value={password} onChange={e => setPassword(e.target.value)} required /></div>
      <button className="btn auth-submit" type="submit" disabled={busy}>{busy ? 'Patiente…' : 'Enregistrer le mot de passe'}</button>
    </form>
  </section></main>
}

function Table({ rows, onOpen }) {
  return <div className="tw"><table className="pme-table"><thead><tr>
    <th>Entreprise</th><th>Catégorie</th><th>N° autorisation REGEDEK</th><th>Statut REGEDEK</th><th>Expiration REGEDEK</th><th>Statut ministériel</th><th>Expiration ministérielle</th><th>Téléphone</th><th>Actions</th>
  </tr></thead><tbody>
    {rows.map(r => <tr key={r.id} className="cl" onClick={() => onOpen(r)}>
      <td data-label="Entreprise"><b>{r.nom}</b></td>
      <td data-label="Catégorie">{r.type || '—'}</td>
      <td data-label="N° autorisation REGEDEK">{r.numAut || '—'}</td>
      <td data-label="Statut REGEDEK"><Tag s={r.sAut} /></td>
      <td data-label="Expiration REGEDEK">{fmt(r.expAut)}</td>
      <td data-label="Statut ministériel"><Tag s={r.sAgr} /></td>
      <td data-label="Expiration ministérielle">{fmt(r.expAgr)}</td>
      <td data-label="Téléphone">{r.tel || '—'}</td>
      <td data-label="Actions"><button className="btn sec" onClick={(e) => { e.stopPropagation(); onOpen(r) }}>Voir</button></td>
    </tr>)}
    {!rows.length && <tr><td colSpan="9">Aucun résultat.</td></tr>}
  </tbody></table></div>
}

function PmeForm({ p, onSave, onClose }) {
  const [f, setF] = useState(p)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const F = ({ k, l, t = 'text', full }) => <div className={full ? 'full' : ''}><label>{l}</label><input type={t} value={f[k]} onChange={set(k)} /></div>
  return <div className="modal"><div className="box">
    <h2>{f.id ? 'Modifier la PME' : 'Nouvelle PME'}</h2>
    <div className="grid">
      <F k="nom" l="Nom de la PME *" />
      <div><label>Type</label><select value={f.type} onChange={set('type')}><option>MENAGE</option><option>HORECA</option></select></div>
      <F k="contact" l="Personne à contacter" /><F k="tel" l="Téléphone" />
      <F k="email" l="E-mail" t="email" /><F k="adresse" l="Adresse physique" />
      <F k="communes" l="Communes desservies" /><F k="quartiers" l="Quartiers" />
      <F k="statutJuridique" l="Statut juridique" /><F k="note" l="Remarque" />
      <F k="numAut" l="N° autorisation REGEDEK" full />
      <F k="dateAut" l="Date autorisation REGEDEK" t="date" /><F k="expAut" l="Expiration autorisation" t="date" />
      <F k="dateAgr" l="Date agrément ministère" t="date" /><F k="expAgr" l="Expiration agrément" t="date" />
    </div>
    <div className="row"><button className="btn sec" onClick={onClose}>Annuler</button>
      <button className="btn" onClick={() => f.nom.trim() ? onSave(f) : alert('Le nom est obligatoire')}>Enregistrer</button></div>
  </div></div>
}

function AchatForm({ a, pmes, onSave, onClose }) {
  const [f, setF] = useState(a)
  return <div className="modal"><div className="box">
    <h2>Enregistrer un achat de sacs</h2>
    <div className="grid">
      <div className="full"><label>PME</label><select value={f.pmeId} onChange={e => setF({ ...f, pmeId: +e.target.value })}>{pmes.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}</select></div>
      <div><label>Date d'achat</label><input type="date" value={f.date} onChange={e => setF({ ...f, date: e.target.value })} /></div>
      <div><label>Quantité de sacs</label><input type="number" value={f.qte} onChange={e => setF({ ...f, qte: e.target.value })} /></div>
    </div>
    <div className="row"><button className="btn sec" onClick={onClose}>Annuler</button>
      <button className="btn" onClick={() => f.qte > 0 && f.date ? onSave(f) : alert('Date et quantité obligatoires')}>Enregistrer</button></div>
  </div></div>
}
