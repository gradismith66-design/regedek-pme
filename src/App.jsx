import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from './supabase.js'
import { statutExp, statutActivite } from './status.js'

const Tag = ({ s }) => <span className={`tag ${s.cls}`}>{s.label}</span>
const fmt = (d) => d ? d.split('-').reverse().join('/') : '—'
const normalize = (v) => (v ?? '').toString().trim()
const supabaseProjectHost = import.meta.env.VITE_SUPABASE_URL?.match(/^https?:\/\/([^/]+)/)?.[1] || 'inconnu'
const FIRST_ADMIN_EMAIL = 'gradismith66@gmail.com'
const DOSSIER_STATUSES = ['DOSSIER_NON_SOUMIS', 'DOSSIER_RECU', 'DOSSIER_INCOMPLET', 'DOCUMENTS_MANQUANTS', 'EN_COURS_DE_VERIFICATION', 'DOSSIER_COMPLET', 'VALIDE_ADMINISTRATIVEMENT', 'REJETE_ADMINISTRATIVEMENT']
const AUTH_STATUSES = ['EXPIRE', 'EN_ETUDE_ADMINISTRATIVE', 'EN_ATTENTE_INSPECTION', 'EN_ATTENTE_SIGNATURE', 'AUTORISE', 'NON_CONFORME']
const DOSSIER_LABELS = { DOSSIER_NON_SOUMIS: 'Dossier non soumis', DOSSIER_RECU: 'Dossier reçu', DOSSIER_INCOMPLET: 'Dossier incomplet', DOCUMENTS_MANQUANTS: 'Documents manquants', EN_COURS_DE_VERIFICATION: 'En cours de vérification', DOSSIER_COMPLET: 'Dossier complet', VALIDE_ADMINISTRATIVEMENT: 'Validé administrativement', REJETE_ADMINISTRATIVEMENT: 'Rejeté administrativement' }
const AUTH_LABELS = { EXPIRE: 'Expiré', EN_ETUDE_ADMINISTRATIVE: 'En étude administrative', EN_ATTENTE_INSPECTION: "En attente d'inspection", EN_ATTENTE_SIGNATURE: 'En attente de signature', AUTORISE: 'Autorisé', NON_CONFORME: 'Non conforme' }
const DOSSIER_COLORS = { DOSSIER_NON_SOUMIS: 'gris', DOSSIER_RECU: 'bleu', DOSSIER_INCOMPLET: 'orange', DOCUMENTS_MANQUANTS: 'rouge-clair', EN_COURS_DE_VERIFICATION: 'violet', DOSSIER_COMPLET: 'bleu-fonce', VALIDE_ADMINISTRATIVEMENT: 'vert', REJETE_ADMINISTRATIVEMENT: 'rouge' }
const AUTH_COLORS = { EXPIRE: 'rouge', EN_ETUDE_ADMINISTRATIVE: 'bleu', EN_ATTENTE_INSPECTION: 'orange', EN_ATTENTE_SIGNATURE: 'violet', AUTORISE: 'vert', NON_CONFORME: 'rouge' }
const MORATORIUM_WARNING_DAYS = 15
const MORATORIUM_STATUS_LABELS = { active: 'Moratoire en cours', soon: 'Expire prochainement', expired: 'Moratoire expiré', upcoming: 'À venir', none: 'Aucun moratoire attribué' }
const MORATORIUM_STATUS_COLORS = { active: 'vert', soon: 'orange', expired: 'rouge', upcoming: 'bleu', none: 'gris' }
const PURCHASE_STATUS_LABELS = { EN_ATTENTE: 'En attente de validation', VALIDE: 'Validé', ANNULE: 'Annulé' }
const PURCHASE_STATUS_COLORS = { EN_ATTENTE: 'orange', VALIDE: 'vert', ANNULE: 'gris' }
const ACTIVITY_LABELS = {
  'pme.created': 'PME ajoutée', 'pme.updated': 'PME modifiée', 'pme.archived': 'PME archivée',
  'pme.restored': 'PME restaurée', 'pme.dossier.updated': 'Dossier administratif modifié',
  'authorization.updated': 'Autorisation ou agrément modifié', 'purchase.created': 'Achat enregistré',
  'purchase.updated': 'Achat modifié', 'purchase.deleted': 'Achat supprimé',
  'document.created': 'Pièce justificative ajoutée', 'document.updated': 'Pièce justificative modifiée',
  'document.deleted': 'Pièce justificative supprimée', 'inspection.created': 'Inspection enregistrée',
  'staff.invited': 'Compte invité', 'staff.role.updated': 'Rôle utilisateur modifié',
  'staff.permission.updated': 'Permission personnalisée modifiée', 'settings.updated': 'Paramètres modifiés',
  'moratorium.created': 'Moratoire accordé', 'purchase.status.updated': 'Statut d’achat modifié',
}
const dossierTag = status => ({ label: DOSSIER_LABELS[status] || 'Dossier non soumis', cls: DOSSIER_COLORS[status] || 'gris' })
const todayKinshasa = () => {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'Africa/Kinshasa', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const part = type => parts.find(item => item.type === type)?.value || ''
  return `${part('year')}-${part('month')}-${part('day')}`
}
const isAuthorizationExpired = (status, expiry) => status === 'EXPIRE'
  || (status === 'AUTORISE' && Boolean(expiry) && expiry < todayKinshasa())
const authTag = (status, expiry) => status === 'AUTORISE' && expiry && expiry < todayKinshasa()
  ? { label: 'Expiré', cls: 'rouge' }
  : ({ label: AUTH_LABELS[status] || AUTH_LABELS.EN_ETUDE_ADMINISTRATIVE, cls: AUTH_COLORS[status] || 'bleu' })
const VIDE = { nom: '', type: 'MENAGE', numAut: '', dateAut: '', expAut: '', dateAgr: '', expAgr: '', contact: '', tel: '', email: '', adresse: '', communes: '', quartiers: '', statutJuridique: '', source: 'saisie manuelle', note: '', dossierStatus: 'DOSSIER_NON_SOUMIS', dossierObservations: '', authorizationStatus: 'EN_ETUDE_ADMINISTRATIVE', authorizationReference: '', authorizationIssueDate: '', authorizationExpiryDate: '', authorizationObservations: '', nonComplianceReason: '', authorizationChangeReason: '', authoritySignerName: '', authoritySignerTitle: '' }

const toPme = (p) => ({
  id: p.id, nom: p.nom, type: p.type, createdAt: p.created_at, numAut: p.num_aut, dateAut: p.date_aut || '', expAut: p.exp_aut || '',
  dateAgr: p.date_agr || '', expAgr: p.exp_agr || '', contact: p.contact, fonction: p.fonction, tel: p.tel,
  email: p.email, adresse: p.adresse, communes: p.communes, quartiers: p.quartiers,
  statutJuridique: p.statut_juridique, source: p.source, nbAutorisations: p.nb_autorisations, note: p.note,
  dossierStatus: p.dossier_status, dossierObservations: p.dossier_observations || '',
  authorizationStatus: p.authorization_status, authorizationReference: p.authorization_reference || '',
  authorizationIssueDate: p.authorization_issue_date || '', authorizationExpiryDate: p.authorization_expiry_date || '',
  authorizationObservations: p.authorization_observations || '', nonComplianceReason: p.non_compliance_reason || '',
  authorizationAgentId: p.authorization_agent_id, authorizationUpdatedAt: p.authorization_updated_at,
  dossierUpdatedAt: p.dossier_updated_at, dossierUpdatedBy: p.dossier_updated_by,
  authoritySignerName: p.authority_signer_name || '', authoritySignerTitle: p.authority_signer_title || '',
  verificationToken: p.authorization_verification_token, archivedAt: p.archived_at,
})
const toDocument = d => ({ id: d.id, pmeId: d.pme_id, name: d.document_name, required: d.is_required, status: d.status, path: d.storage_path, filename: d.original_filename, mime: d.mime_type, size: d.file_size, observations: d.observations, rejectionReason: d.rejection_reason, createdAt: d.created_at, updatedAt: d.updated_at })
const toInspection = x => ({ id: x.id, pmeId: x.pme_id, result: x.result, observations: x.observations, date: x.inspection_date, inspectorId: x.inspector_id, createdAt: x.created_at })
const toHistory = h => ({ ...h, actor: h.actor_id })
const toAchat = (a) => ({
  id: a.id, pmeId: a.pme_id, date: a.date, qte: a.qte, detail: a.detail || [],
  designation: a.designation || '', unite: a.unite || 'sacs',
  prixUnitaire: a.prix_unitaire, devise: a.devise || '', montantTotal: a.montant_total,
  status: a.status || 'VALIDE',
})
const toMoratorium = row => ({
  id: row.id, pmeId: row.pme_id, startsOn: row.starts_on, expiresOn: row.expires_on,
  durationDays: row.duration_days, reason: row.reason, observations: row.observations || '',
  attachmentPath: row.attachment_path || '', attachmentName: row.attachment_name || '',
  grantedByName: row.granted_by_name || 'Non renseigné', grantedByEmail: row.granted_by_email || '',
  createdAt: row.created_at,
})
const sortMoratoriaLatestFirst = rows => [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id)
const isTrashBagPurchase = purchase => {
  const designation = normalize(purchase.designation).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[-_]+/g, ' ')
  const unit = normalize(purchase.unite).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[-_]+/g, ' ')
  return /\bsacs?\s*(?:(?:a|pour)\s*)?poubelles?\b/.test(designation)
    && /^sacs?(?:\s+poubelles?)?$/.test(unit)
}
const getMoratoriumStatus = (moratorium, today) => {
  if (!moratorium) return { code: 'none', daysRemaining: null }
  const daysUntilStart = Math.ceil((Date.parse(`${moratorium.startsOn}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000)
  const daysRemaining = Math.ceil((Date.parse(`${moratorium.expiresOn}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000)
  if (daysUntilStart > 0) return { code: 'upcoming', daysRemaining, daysUntilStart }
  if (daysRemaining < 0) return { code: 'expired', daysRemaining }
  if (daysRemaining <= MORATORIUM_WARNING_DAYS) return { code: 'soon', daysRemaining }
  return { code: 'active', daysRemaining }
}
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

const dateKeyInKinshasa = value => {
  if (!value) return ''
  const date = String(value)
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Africa/Kinshasa', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(date))
  const part = type => parts.find(item => item.type === type)?.value || ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

const makeDashboardBuckets = (period, now = new Date()) => {
  const today = dateKeyInKinshasa(now.toISOString())
  const [year, month, day] = today.split('-').map(Number)
  const size = period === 'day' ? 14 : period === 'month' ? 12 : 5
  return Array.from({ length: size }, (_, index) => {
    const offset = index - size + 1
    const date = period === 'day'
      ? new Date(Date.UTC(year, month - 1, day + offset))
      : period === 'month'
        ? new Date(Date.UTC(year, month - 1 + offset, 1))
        : new Date(Date.UTC(year + offset, 0, 1))
    const key = period === 'day'
      ? date.toISOString().slice(0, 10)
      : period === 'month'
        ? date.toISOString().slice(0, 7)
        : date.toISOString().slice(0, 4)
    const label = period === 'day'
      ? new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', day: '2-digit', month: '2-digit' }).format(date)
      : period === 'month'
        ? new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', month: 'short' }).format(date).replace('.', '')
        : key
    return { key, label }
  })
}

const bucketKeyFor = (value, period) => {
  const date = dateKeyInKinshasa(value)
  return period === 'day' ? date : period === 'month' ? date.slice(0, 7) : date.slice(0, 4)
}

const aggregateBuckets = (items, buckets, period, getDate, getValue = () => 1) => {
  const values = new Map(buckets.map(bucket => [bucket.key, 0]))
  for (const item of items) {
    const key = bucketKeyFor(getDate(item), period)
    if (values.has(key)) values.set(key, values.get(key) + Number(getValue(item) || 0))
  }
  return buckets.map(bucket => ({ ...bucket, value: values.get(bucket.key) }))
}

function HorizontalBarChart({ title, data, format = value => value.toLocaleString('fr-FR'), note }) {
  const max = Math.max(1, ...data.map(item => item.value))
  const colors = ['#245b91', '#348b78', '#bf7a2a', '#7357a3', '#bd5260', '#3985a8', '#788b3f', '#9b6549']
  return <section className="dashboard-chart" aria-label={title}>
    <h3>{title}</h3>
    {note && <p className="chart-note">{note}</p>}
    {data.length ? <div className="horizontal-bars" role="list">
      {data.map((item, index) => <div className="horizontal-bar-row" role="listitem" key={item.label} style={{ '--bar-color': colors[index % colors.length] }}>
        <span className="horizontal-bar-label">{item.label}</span>
        <span className="horizontal-bar-track"><span className="horizontal-bar-fill" style={{ width: `${item.value ? Math.max(2, item.value / max * 100) : 0}%` }} /></span>
        <strong className="horizontal-bar-value">{format(item.value)}</strong>
      </div>)}
    </div> : <p className="chart-empty">Aucune donnée disponible pour cette période.</p>}
  </section>
}

function DashboardStatSection({ title, cards, chart, note }) {
  return <section className="dashboard-stat-section">
    <div className="dashboard-stat-summary">
      <h2>{title}</h2>
      <div className="cards dashboard-stat-cards">
        {cards.map(card => <div className={`card${card.onClick ? '' : ' static'}`} key={card.label} onClick={card.onClick}>
          <b>{typeof card.value === 'number' ? card.value.toLocaleString('fr-FR') : card.value}</b><span>{card.label}</span>
        </div>)}
      </div>
      {note && <p className="metric-note">{note}</p>}
    </div>
    <div className="dashboard-stat-visual">{chart}</div>
  </section>
}

function TrendBarChart({ title, data, format = value => value.toLocaleString('fr-FR'), note }) {
  const max = Math.max(1, ...data.map(item => item.value))
  return <section className="dashboard-chart" aria-label={title}>
    <h3>{title}</h3>
    {note && <p className="chart-note">{note}</p>}
    {data.length ? <div className="trend-scroll">
      <div className="trend-bars" style={{ gridTemplateColumns: `repeat(${data.length}, minmax(24px, 1fr))` }}>
        {data.map((item, index) => <div className="trend-bar-column" key={item.key} title={`${item.label} : ${format(item.value)}`} style={{ '--trend-color': ['#245b91', '#348b78', '#bf7a2a', '#7357a3', '#bd5260', '#3985a8', '#788b3f', '#9b6549'][index % 8] }}>
          <strong>{format(item.value)}</strong>
          <div className="trend-bar-area"><span style={{ height: `${item.value ? Math.max(3, item.value / max * 100) : 0}%` }} /></div>
          <small>{item.label}</small>
        </div>)}
      </div>
    </div> : <p className="chart-empty">Aucune donnée disponible pour cette période.</p>}
  </section>
}

export default function App() {
  const [session, setSession] = useState(undefined)
  const [role, setRole] = useState(null)
  const [permissions, setPermissions] = useState([])
  const [dataReady, setDataReady] = useState(false)
  const [accessError, setAccessError] = useState('')
  const [bootstrapAvailable, setBootstrapAvailable] = useState(null)
  const [authBusy, setAuthBusy] = useState(false)
  const [authNotice, setAuthNotice] = useState('')
  const [passwordRecovery, setPasswordRecovery] = useState(false)
  const [pmes, setPmes] = useState([])
  const [archivedPmes, setArchivedPmes] = useState([])
  const [achats, setAchats] = useState([])
  const [moratoria, setMoratoria] = useState([])
  const [documents, setDocuments] = useState([])
  const [inspections, setInspections] = useState([])
  const [dossierHistory, setDossierHistory] = useState([])
  const [authorizationHistory, setAuthorizationHistory] = useState([])
  const [verificationResult, setVerificationResult] = useState(undefined)
  const [certificate, setCertificate] = useState(null)
  const [cfg, setCfg] = useState({ alerte: 30, inactif: 90 })
  const [notice, setNotice] = useState('')
  const [tab, setTab] = useState('dash')
  const [summaryQuery, setSummaryQuery] = useState('')
  const [summaryAuthorizationFilter, setSummaryAuthorizationFilter] = useState('')
  const [summaryMoratoriumFilter, setSummaryMoratoriumFilter] = useState('')
  const [summarySort, setSummarySort] = useState('name')
  const [summarySortDirection, setSummarySortDirection] = useState('asc')
  const [moratoriumFormOpen, setMoratoriumFormOpen] = useState(false)
  const [moratoriumHistoryPme, setMoratoriumHistoryPme] = useState(null)
  const [moratoriumBusy, setMoratoriumBusy] = useState(false)
  const [moratoriumNotice, setMoratoriumNotice] = useState('')
  const [moratoriumToday, setMoratoriumToday] = useState(todayKinshasa())
  const moratoriumSubmissionLock = useRef(false)
  const [dashboardPeriod, setDashboardPeriod] = useState('month')
  const [dashboardActivities, setDashboardActivities] = useState([])
  const [dashboardActivityBusy, setDashboardActivityBusy] = useState(false)
  const [q, setQ] = useState('')
  const [fType, setFType] = useState('')
  const [fCommune, setFCommune] = useState('')
  const [fStatAut, setFStatAut] = useState('')
  const [fStatMin, setFStatMin] = useState('')
  const [fDossierStatus, setFDossierStatus] = useState('')
  const [fAuthorizationStatus, setFAuthorizationStatus] = useState('')
  const [fYear, setFYear] = useState('')
  const [fTransaction, setFTransaction] = useState('')
  const [fRenewal, setFRenewal] = useState('')
  const [fIncomplete, setFIncomplete] = useState(false)
  const [edit, setEdit] = useState(null)
  const [achatFor, setAchatFor] = useState(null)
  const [detail, setDetail] = useState(null)
  const [staffUsers, setStaffUsers] = useState([])
  const [staffUsersBusy, setStaffUsersBusy] = useState(false)
  const [activityRows, setActivityRows] = useState([])
  const [recentActivities, setRecentActivities] = useState([])
  const [activityFilters, setActivityFilters] = useState({ actor: '', operation: '', from: '', to: '' })
  const [activityBusy, setActivityBusy] = useState(false)
  const [activityNotification, setActivityNotification] = useState('')
  const [unreadActivityCount, setUnreadActivityCount] = useState(0)

  useEffect(() => {
    if (!supabase) return
    let active = true
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true)
      setSession(nextSession)
    })
    Promise.all([supabase.auth.getSession(), supabase.rpc('admin_bootstrap_available')])
      .then(([sessionResult, bootstrapResult]) => {
        if (!active) return
        if (sessionResult.error) setAuthNotice(`Impossible de charger la session : ${sessionResult.error.message}`)
        setSession(sessionResult.data?.session ?? null)
        if (bootstrapResult.error) {
          setBootstrapAvailable(false)
          setAuthNotice(`Initialisation admin indisponible : ${bootstrapResult.error.message}. Vérifie que les migrations REGEDEK PME sont appliquées sur le projet Supabase configuré.`)
        } else {
          setBootstrapAvailable(Boolean(bootstrapResult.data))
        }
      })
      .catch(error => {
        if (!active) return
        setBootstrapAvailable(false)
        setSession(null)
        setAuthNotice(`Impossible de joindre Supabase : ${error.message}`)
      })
    return () => { active = false; subscription.unsubscribe() }
  }, [])

  const verificationToken = new URLSearchParams(window.location.search).get('verification')
  useEffect(() => {
    if (!verificationToken || !supabase) return
    let active = true
    supabase.rpc('verify_pme_authorization', { verification_token: verificationToken }).then(({ data, error }) => {
      if (!active) return
      if (error) setVerificationResult({ error: error.message })
      else setVerificationResult(Array.isArray(data) ? data[0] || null : data || null)
    })
    return () => { active = false }
  }, [verificationToken])

  useEffect(() => {
    if (!supabase || session === undefined) return
    let cancelled = false
    setDataReady(false); setRole(null); setAccessError(''); setNotice(''); setMoratoria([])
    const load = async () => {
      if (!session) {
        setRole(null); setPermissions([]); setPmes([]); setArchivedPmes([]); setAchats([]); setDataReady(true)
        return
      }

      let staff = null
      const { data, error } = await supabase.from('staff_profiles').select('role').eq('user_id', session.user.id).maybeSingle()
      if (error) throw error
      staff = data
      if (!staff && session.user.email?.toLowerCase() === FIRST_ADMIN_EMAIL) {
        const { data: canBootstrap, error: bootstrapCheckError } = await supabase.rpc('admin_bootstrap_available')
        if (bootstrapCheckError) throw bootstrapCheckError
        setBootstrapAvailable(Boolean(canBootstrap))
        if (canBootstrap) {
          const { error: bootstrapError } = await supabase.rpc('bootstrap_first_admin')
          if (bootstrapError) throw bootstrapError
          const result = await supabase.from('staff_profiles').select('role').eq('user_id', session.user.id).single()
          staff = result.data
          if (result.error) throw result.error
          setBootstrapAvailable(false)
        }
      }
      const nextRole = staff?.role ?? null
      if (!nextRole) {
        if (cancelled) return
        setRole(null); setPermissions([]); setPmes([]); setAchats([]); setDataReady(true)
        return
      }
      const { data: currentPermissions, error: permissionError } = await supabase.rpc('my_permissions')
      if (permissionError) throw permissionError
      if (!currentPermissions?.length) {
        if (cancelled) return
        setRole(nextRole); setPermissions([]); setPmes([]); setArchivedPmes([]); setAchats([]); setDataReady(true)
        return
      }

      const [pmeRows, achatRows, settingsResult, documentRows, dossierRows, authorizationRows, inspectionRows, moratoriumRows] = await Promise.all([
        fetchAll('pmes', 'id'),
        fetchAll('achats', 'date', false),
        supabase.from('settings').select('alerte, inactif').eq('id', true).single(),
        fetchAll('pme_documents', 'created_at', false),
        fetchAll('pme_dossier_history', 'created_at', false),
        fetchAll('pme_authorization_history', 'created_at', false),
        fetchAll('pme_inspection_reports', 'inspection_date', false),
        fetchAll('pme_moratoria', 'created_at', false),
      ])
      if (settingsResult.error) throw settingsResult.error
      if (cancelled) return
      const allPmes = pmeRows.map(toPme)
      setRole(nextRole); setPermissions(currentPermissions); setPmes(allPmes.filter(p => !p.archivedAt)); setArchivedPmes(allPmes.filter(p => p.archivedAt)); setAchats(achatRows.map(toAchat)); setMoratoria(sortMoratoriaLatestFirst(moratoriumRows.map(toMoratorium))); setDocuments(documentRows.map(toDocument)); setInspections(inspectionRows.map(toInspection)); setDossierHistory(dossierRows.map(toHistory)); setAuthorizationHistory(authorizationRows.map(toHistory)); setCfg(settingsResult.data); setDataReady(true)
    }
    load().catch(error => { if (!cancelled) { setAccessError(error.message); setDataReady(true) } })
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
    else if (data.user && (data.user.identities?.length ?? 0) === 0) setAuthNotice(`Le compte ${FIRST_ADMIN_EMAIL} existe déjà. Retourne à la connexion ou utilise « Mot de passe oublié ? »; après connexion, son rôle admin sera activé.`)
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

  const hasPermission = permission => permissions.includes(permission)
  const canEdit = hasPermission('pme.update')
  const canCreatePme = hasPermission('pme.create')
  const canCreatePurchase = hasPermission('purchase.create')
  const canUpdatePurchase = hasPermission('purchase.update')
  const canDeletePurchase = hasPermission('purchase.delete')
  const canValidatePurchases = hasPermission('purchase.validate')
  const canManageMoratoria = hasPermission('moratorium.manage')
  const canReadSummary = hasPermission('pme.read') && hasPermission('purchase.read')
  const canManageDossier = hasPermission('pme.dossier.manage')
  const canManageAuthorization = hasPermission('pme.authorization.manage')
  const canArchivePme = hasPermission('pme.archive')
  const canCreateInspection = hasPermission('inspection.create')
  const canManageDocuments = hasPermission('document.upload') || hasPermission('document.update')
  const canReviewDocuments = hasPermission('document.review')
  const canDeleteDocuments = hasPermission('document.delete')
  const canManageStaff = hasPermission('staff.manage')
  const canReadActivities = hasPermission('activity.read')
  const canReadReports = hasPermission('reports.read')
  const reportError = (error) => setNotice(`Opération impossible : ${error.message}`)

  useEffect(() => {
    const refreshToday = () => {
      const currentDay = todayKinshasa()
      setMoratoriumToday(previous => previous === currentDay ? previous : currentDay)
    }
    const timer = window.setInterval(refreshToday, 60_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (tab !== 'users' || !canManageStaff) return
    let active = true
    setStaffUsersBusy(true)
    supabase.rpc('admin_list_staff').then(({ data, error }) => {
      if (!active) return
      if (error) reportError(error)
      else setStaffUsers(data || [])
      setStaffUsersBusy(false)
    }).catch(error => {
      if (!active) return
      reportError(error)
      setStaffUsersBusy(false)
    })
    return () => { active = false }
  }, [tab, canManageStaff])

  useEffect(() => {
    if (!canReadActivities) return
    let active = true
    const loadLatest = async () => {
      const { data, error } = await supabase.from('staff_activity_log').select('*')
        .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(5)
      if (!active) return
      if (error) reportError(error)
      else setRecentActivities(data || [])
    }
    loadLatest()
    const channel = supabase.channel('staff-activity-notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'staff_activity_log' }, payload => {
        if (!active) return
        const activity = payload.new
        setRecentActivities(current => [activity, ...current.filter(item => item.id !== activity.id)].slice(0, 5))
        setDashboardActivities(current => [activity, ...current.filter(item => item.id !== activity.id)])
        if (activity.actor_id !== session?.user?.id) {
          if (tab !== 'activity') setUnreadActivityCount(current => current + 1)
          setActivityNotification(`${activity.actor_name} a effectué l’opération « ${ACTIVITY_LABELS[activity.operation] || activity.operation} ».`)
        }
      })
      .subscribe(status => {
        if (active && (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT')) {
          setNotice('Les notifications en temps réel sont indisponibles. Consulte l’onglet Activités pour actualiser le journal.')
        }
      })
    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [canReadActivities, session?.user?.id, tab])

  useEffect(() => {
    if (!['dash', 'summary'].includes(tab) || !session?.user?.id || !role) return
    let active = true
    const refreshPmes = async () => {
      try {
        const allPmes = (await fetchAll('pmes', 'id')).map(toPme)
        if (active) {
          setPmes(allPmes.filter(pme => !pme.archivedAt))
          setArchivedPmes(allPmes.filter(pme => pme.archivedAt))
        }
      } catch (error) {
        if (active) reportError(error)
      }
    }
    const refreshPurchases = async () => {
      try {
        const purchases = (await fetchAll('achats', 'date', false)).map(toAchat)
        if (active) setAchats(purchases)
      } catch (error) {
        if (active) reportError(error)
      }
    }
    const refreshMoratoria = async () => {
      try {
        const rows = sortMoratoriaLatestFirst((await fetchAll('pme_moratoria', 'created_at', false)).map(toMoratorium))
        if (active) setMoratoria(rows)
      } catch (error) {
        if (active) reportError(error)
      }
    }
    const refresh = () => {
      if (document.visibilityState === 'visible') {
        refreshPmes()
        refreshPurchases()
        refreshMoratoria()
      }
    }
    const interval = window.setInterval(refresh, 60_000)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      active = false
      window.clearInterval(interval)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [tab, session?.user?.id, role])

  useEffect(() => {
    if (tab !== 'activity' || !canReadActivities) return
    let active = true
    setActivityBusy(true)
    setActivityRows([])
    let query = supabase.from('staff_activity_log').select('*')
      .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(500)
    if (activityFilters.actor.trim()) query = query.ilike('actor_email', `%${activityFilters.actor.trim()}%`)
    if (activityFilters.operation) query = query.eq('operation', activityFilters.operation)
    if (activityFilters.from) query = query.gte('created_at', new Date(`${activityFilters.from}T00:00:00.000Z`).toISOString())
    if (activityFilters.to) {
      const toExclusive = new Date(`${activityFilters.to}T00:00:00.000Z`)
      toExclusive.setUTCDate(toExclusive.getUTCDate() + 1)
      query = query.lt('created_at', toExclusive.toISOString())
    }
    query.then(({ data, error }) => {
      if (!active) return
      if (error) reportError(error)
      else setActivityRows(data || [])
      setActivityBusy(false)
    }).catch(error => {
      if (!active) return
      reportError(error)
      setActivityBusy(false)
    })
    return () => { active = false }
  }, [tab, canReadActivities, session?.user?.id, activityFilters.actor, activityFilters.operation, activityFilters.from, activityFilters.to])

  const reloadStaffUsers = async () => {
    const { data, error } = await supabase.rpc('admin_list_staff')
    if (error) { reportError(error); return false }
    setStaffUsers(data || [])
    return true
  }
  const changeStaffRole = async (email, nextRole) => {
    const { error } = await supabase.rpc('admin_set_staff_role', { p_email: email, p_role: nextRole })
    if (error) { reportError(error); return }
    setNotice(`Rôle mis à jour pour ${email}.`)
    await reloadStaffUsers()
  }
  const changeCustomPermission = async (email, permission, enabled) => {
    const { error } = await supabase.rpc('admin_set_custom_permission', { p_email: email, p_permission: permission, p_enabled: enabled })
    if (error) { reportError(error); return }
    await reloadStaffUsers()
  }
  const inviteStaff = async ({ email, role: invitedRole }) => {
    setStaffUsersBusy(true)
    const { data, error } = await supabase.functions.invoke('manage-staff', {
      body: { action: 'invite', email, role: invitedRole },
    })
    if (error) reportError(error)
    else setNotice(data?.message || `Invitation envoyée à ${email}.`)
    await reloadStaffUsers()
    setStaffUsersBusy(false)
  }

  const rows = useMemo(() => [...pmes].sort((a, b) => a.id - b.id).map((p, index) => {
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

    return { ...p, numero: index + 1, mine, dernier, totalSacs, sAut, sAgr, sAct, transaction, year, isIncomplete, communes }
  }), [pmes, achats, cfg])

  const dashboardBuckets = useMemo(() => makeDashboardBuckets(dashboardPeriod), [dashboardPeriod])
  const dashboardPmes = [...pmes, ...archivedPmes]
  const dashboardPmeTrend = aggregateBuckets(dashboardPmes, dashboardBuckets, dashboardPeriod, pme => pme.createdAt)
  const dashboardPurchaseTrend = aggregateBuckets(achats, dashboardBuckets, dashboardPeriod, purchase => purchase.date)
  const dashboardAmountTrends = ['CDF', 'USD'].map(currency => ({
    currency,
    data: aggregateBuckets(
      achats.filter(purchase => purchase.devise === currency && purchase.montantTotal != null),
      dashboardBuckets,
      dashboardPeriod,
      purchase => purchase.date,
      purchase => Number(purchase.montantTotal),
    ),
  })).filter(series => achats.some(purchase => purchase.devise === series.currency && purchase.montantTotal != null))
  const dashboardActivityTrend = aggregateBuckets(dashboardActivities, dashboardBuckets, dashboardPeriod, activity => activity.created_at)
  const dashboardActivityByStaff = Object.entries(dashboardActivities.reduce((totals, activity) => {
    const key = bucketKeyFor(activity.created_at, dashboardPeriod)
    if (dashboardBuckets.some(bucket => bucket.key === key)) {
      const name = activity.actor_name || 'Nom non renseigné'
      totals[name] = (totals[name] || 0) + 1
    }
    return totals
  }, {})).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 8)
  const dashboardPurchaseTotals = ['CDF', 'USD'].map(currency => ({
    currency,
    amount: achats.filter(purchase => purchase.devise === currency && purchase.montantTotal != null)
      .reduce((sum, purchase) => sum + Number(purchase.montantTotal), 0),
  })).filter(total => achats.some(purchase => purchase.devise === total.currency && purchase.montantTotal != null))
  const summaryYear = Number(moratoriumToday.slice(0, 4))
  const moratoriumByPme = new Map()
  for (const moratorium of moratoria) {
    if (!moratoriumByPme.has(moratorium.pmeId)) moratoriumByPme.set(moratorium.pmeId, moratorium)
  }
  const summaryRows = pmes.map(pme => {
    const moratorium = moratoriumByPme.get(pme.id) || null
    const moratoriumStatus = getMoratoriumStatus(moratorium, moratoriumToday)
    const authorizationStatus = isAuthorizationExpired(pme.authorizationStatus, pme.authorizationExpiryDate)
      ? 'EXPIRE'
      : pme.authorizationStatus === 'AUTORISE'
        ? 'AUTORISE'
        : pme.authorizationStatus === 'NON_CONFORME'
          ? 'NON_CONFORME'
          : 'EN_ATTENTE'
    const trashBagQuantity = achats.reduce((sum, purchase) => {
      if (purchase.pmeId !== pme.id || purchase.status !== 'VALIDE' || !isTrashBagPurchase(purchase)) return sum
      const purchaseYear = Number(String(purchase.date || '').slice(0, 4))
      return purchaseYear === summaryYear && purchase.date <= moratoriumToday ? sum + Number(purchase.qte || 0) : sum
    }, 0)
    return { pme, moratorium, moratoriumStatus, authorizationStatus, trashBagQuantity }
  })
  const filteredSummaryRows = summaryRows
    .filter(row => !summaryQuery.trim() || row.pme.nom.toLowerCase().includes(summaryQuery.trim().toLowerCase()))
    .filter(row => !summaryAuthorizationFilter || row.authorizationStatus === summaryAuthorizationFilter)
    .filter(row => !summaryMoratoriumFilter || row.moratoriumStatus.code === summaryMoratoriumFilter)
    .sort((a, b) => {
      const direction = summarySortDirection === 'asc' ? 1 : -1
      if (summarySort === 'expiry') {
        if (!a.moratorium) return b.moratorium ? 1 : 0
        if (!b.moratorium) return -1
        return a.moratorium.expiresOn.localeCompare(b.moratorium.expiresOn) * direction
      }
      if (summarySort === 'bags') return (a.trashBagQuantity - b.trashBagQuantity) * direction
      return a.pme.nom.localeCompare(b.pme.nom, 'fr', { sensitivity: 'base' }) * direction
    })
  useEffect(() => {
    if (tab !== 'dash' || !canReadActivities || !dashboardBuckets.length) return
    let active = true
    setDashboardActivityBusy(true)
    const loadDashboardActivities = async () => {
      try {
        let offset = 0
        const all = []
        while (true) {
          const { data, error } = await supabase.from('staff_activity_log')
            .select('id, created_at, actor_name')
            .gte('created_at', new Date(new Date(`${dashboardBuckets[0].key}T00:00:00.000Z`).getTime() - 60 * 60 * 1000).toISOString())
            .order('created_at', { ascending: true })
            .range(offset, offset + 499)
          if (error) throw error
          all.push(...data)
          if (data.length < 500) break
          offset += data.length
        }
        if (active) setDashboardActivities(all)
      } catch (error) {
        if (active) {
          setNotice(`Impossible de charger les activités du tableau de bord : ${error.message}`)
          setDashboardActivities([])
        }
      } finally {
        if (active) setDashboardActivityBusy(false)
      }
    }
    loadDashboardActivities()
    return () => { active = false }
  }, [tab, canReadActivities, dashboardBuckets[0]?.key])

  const communeOptions = useMemo(() => Array.from(new Set(rows.flatMap(r => r.communes))).sort(), [rows])
  const yearOptions = useMemo(() => Array.from(new Set(rows.map(r => r.year).filter(Boolean))).sort((a, b) => b.localeCompare(a)), [rows])
  const documentStats = id => {
    const current = documents.filter(d => d.pmeId === id)
    return { asked: current.filter(d => d.required).length, received: current.filter(d => Boolean(d.path)).length, approved: current.filter(d => d.status === 'VALIDE').length, pending: current.filter(d => d.status === 'EN_ATTENTE_DE_VERIFICATION').length, missing: current.filter(d => d.required && ['MANQUANT', 'REJETE'].includes(d.status)).length }
  }

  const filtered = rows.filter(r =>
    (!q || [r.numero, String(r.numero).padStart(3, '0'), r.nom, r.contact, r.numAut, r.adresse, r.tel].join(' ').toLowerCase().includes(q.trim().toLowerCase())) &&
    (!fType || r.type === fType) &&
    (!fCommune || r.communes.some(c => c.toLowerCase().includes(fCommune.toLowerCase()))) &&
    (!fStatAut || r.sAut.label === fStatAut) &&
    (!fStatMin || r.sAgr.label === fStatMin) &&
    (!fDossierStatus || r.dossierStatus === fDossierStatus) &&
    (!fAuthorizationStatus || (r.authorizationStatus === fAuthorizationStatus || (fAuthorizationStatus === 'EXPIRE' && authTag(r.authorizationStatus, r.authorizationExpiryDate).label === 'Expiré'))) &&
    (!fYear || r.year === fYear) &&
    (!fTransaction || r.transaction === fTransaction) &&
    (!fRenewal || (fRenewal === 'oui' ? r.transaction === 'Renouvellement' : r.transaction !== 'Renouvellement')) &&
    (!fIncomplete || r.isIncomplete || documentStats(r.id).missing > 0))

  const count = (f) => rows.filter(f).length
  const horsRegistre = count(r => !normalize(r.source).toLowerCase().includes('registre'))
  const registreSansEcheance = count(r => normalize(r.source).toLowerCase().includes('registre') && !r.expAut)
  const savePme = async (p) => {
    const result = p.id
      ? await supabase.from('pmes').update(pmePayload(p)).eq('id', p.id).select().single()
      : await supabase.from('pmes').insert(pmePayload(p)).select().single()
    if (result.error) { reportError(result.error); return }
    const saved = toPme(result.data)
    setPmes(current => p.id ? current.map(x => x.id === p.id ? saved : x) : [...current, saved]); setEdit(null); setNotice('')
  }
  const saveDossier = async (id, patch) => {
    const { data, error } = await supabase.from('pmes').update({
      dossier_status: patch.status, dossier_observations: patch.observations,
    }).eq('id', id).select().single()
    if (error) { reportError(error); return false }
    setPmes(current => current.map(p => p.id === id ? toPme(data) : p))
    const history = await fetchAll('pme_dossier_history', 'created_at', false)
    setDossierHistory(history.map(toHistory)); setNotice('Statut du dossier enregistré.'); return true
  }
  const saveAuthorization = async (id, patch) => {
    const { data, error } = await supabase.from('pmes').update({
      authorization_status: patch.status, authorization_reference: patch.reference,
      authorization_issue_date: patch.issueDate || null, authorization_expiry_date: patch.expiryDate || null,
      authorization_observations: patch.observations, non_compliance_reason: patch.nonComplianceReason,
      authorization_change_reason: patch.reason, authority_signer_name: patch.signerName,
      authority_signer_title: patch.signerTitle,
    }).eq('id', id).select().single()
    if (error) { reportError(error); return false }
    setPmes(current => current.map(p => p.id === id ? toPme(data) : p))
    const history = await fetchAll('pme_authorization_history', 'created_at', false)
    setAuthorizationHistory(history.map(toHistory)); setNotice('Décision d’autorisation enregistrée.'); return true
  }
  const refreshDossierHistory = async () => {
    try {
      const history = await fetchAll('pme_dossier_history', 'created_at', false)
      setDossierHistory(history.map(toHistory))
      return ''
    } catch (error) {
      return error instanceof Error ? error.message : String(error)
    }
  }
  const saveDocument = async (document, file) => {
    const pmeId = detail?.id
    if (!pmeId || !document.name.trim()) return false
    let path = document.path || null
    if (file) {
      if (file.size > 10 * 1024 * 1024) { setNotice('Le fichier dépasse la limite de 10 Mo.'); return false }
      const safeName = file.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_')
      path = `${pmeId}/${crypto.randomUUID()}-${safeName}`
      const { error: uploadError } = await supabase.storage.from('pme-documents').upload(path, file, { contentType: file.type, upsert: false })
      if (uploadError) { reportError(uploadError); return false }
    }
    const payload = { pme_id: pmeId, document_name: document.name.trim(), is_required: document.required, status: path ? 'EN_ATTENTE_DE_VERIFICATION' : 'MANQUANT', storage_path: path, original_filename: file?.name || document.filename || '', mime_type: file?.type || document.mime || '', file_size: file?.size ?? document.size ?? null, observations: document.observations || '', rejection_reason: '' }
    const { data, error } = document.id
      ? await supabase.from('pme_documents').update(payload).eq('id', document.id).select().single()
      : await supabase.from('pme_documents').insert({ ...payload, created_by: session.user.id }).select().single()
    if (error) {
      if (file && path) {
        const { error: cleanupError } = await supabase.storage.from('pme-documents').remove([path])
        if (cleanupError) {
          setNotice(`Enregistrement impossible : ${error.message}. Le fichier temporaire n’a pas pu être nettoyé : ${cleanupError.message}.`)
          return false
        }
      }
      reportError(error)
      return false
    }
    setDocuments(current => document.id ? current.map(d => d.id === document.id ? toDocument(data) : d) : [toDocument(data), ...current])
    let cleanupWarning = ''
    if (file && document.path && document.path !== path) {
      const { error: cleanupError } = await supabase.storage.from('pme-documents').remove([document.path])
      if (cleanupError) cleanupWarning = `Document remplacé, mais l’ancien fichier n’a pas pu être nettoyé : ${cleanupError.message}.`
    }
    const historyError = await refreshDossierHistory()
    const historyWarning = historyError ? `L’historique n’a pas pu être rechargé : ${historyError}.` : ''
    setNotice([cleanupWarning, historyWarning].filter(Boolean).join(' ') || 'Document enregistré.')
    return true
  }
  const deleteDocument = async doc => {
    const { error } = await supabase.from('pme_documents').delete().eq('id', doc.id)
    if (error) { reportError(error); return }
    setDocuments(current => current.filter(d => d.id !== doc.id))
    let cleanupWarning = ''
    if (doc.path) {
      const { error: storageError } = await supabase.storage.from('pme-documents').remove([doc.path])
      if (storageError) cleanupWarning = `Document retiré du dossier, mais le fichier stocké n’a pas pu être nettoyé : ${storageError.message}.`
    }
    const historyError = await refreshDossierHistory()
    const historyWarning = historyError ? `L’historique n’a pas pu être rechargé : ${historyError}.` : ''
    setNotice([cleanupWarning, historyWarning].filter(Boolean).join(' ') || 'Document supprimé.')
  }
  const reviewDocument = async (doc, status, reason = '') => {
    const { data, error } = await supabase.from('pme_documents').update({ status, rejection_reason: reason, reviewed_by: session.user.id }).eq('id', doc.id).select().single()
    if (error) { reportError(error); return }
    setDocuments(current => current.map(d => d.id === doc.id ? toDocument(data) : d))
    const history = await fetchAll('pme_dossier_history', 'created_at', false); setDossierHistory(history.map(toHistory))
  }
  const updateDocumentObservations = async (doc, observations) => {
    const { data, error } = await supabase.from('pme_documents').update({ observations }).eq('id', doc.id).select().single()
    if (error) { reportError(error); return }
    setDocuments(current => current.map(d => d.id === doc.id ? toDocument(data) : d))
  }
  const saveInspection = async (pmeId, report) => {
    const { data, error } = await supabase.from('pme_inspection_reports').insert({ pme_id: pmeId, result: report.result, observations: report.observations, inspection_date: report.date || undefined }).select().single()
    if (error) { reportError(error); return false }
    setInspections(current => [toInspection(data), ...current]); setNotice('Résultat d’inspection enregistré dans l’historique.'); return true
  }
  const getDocumentUrl = async doc => {
    const { data, error } = await supabase.storage.from('pme-documents').createSignedUrl(doc.path, 60)
    if (error) { reportError(error); return null }
    return data.signedUrl
  }
  const openDocument = async doc => {
    const url = await getDocumentUrl(doc)
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  }
  const openCertificate = pme => {
    if (pme.authorizationStatus !== 'AUTORISE' || !pme.authorizationReference || !pme.authorizationIssueDate || !pme.authorizationExpiryDate || !pme.authoritySignerName || !pme.authoritySignerTitle || pme.authorizationExpiryDate < todayKinshasa()) return
    const verifyUrl = new URL(window.location.href)
    verifyUrl.search = ''; verifyUrl.hash = ''
    verifyUrl.searchParams.set('verification', pme.verificationToken)
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&format=svg&data=${encodeURIComponent(verifyUrl.toString())}`
    setCertificate({ pme, verifyUrl: verifyUrl.toString(), qrUrl })
  }
  const setPmeArchived = async (pme, archived) => {
    if (!canArchivePme || !confirm(archived
      ? `Archiver ${pme.nom} ? Ses achats, documents et historiques seront conservés.`
      : `Restaurer ${pme.nom} dans la liste active ?`)) return
    const { error } = await supabase.rpc('set_pme_archived', { p_pme_id: pme.id, p_archived: archived })
    if (error) { reportError(error); return }
    if (archived) {
      setPmes(current => current.filter(item => item.id !== pme.id))
      setArchivedPmes(current => [{ ...pme, archivedAt: new Date().toISOString() }, ...current])
    } else {
      setArchivedPmes(current => current.filter(item => item.id !== pme.id))
      setPmes(current => [...current, { ...pme, archivedAt: null }])
    }
    setDetail(null)
  }
  const saveAchat = async (a) => {
    const hasPrice = a.prixUnitaire !== '' && a.prixUnitaire != null
    const payload = {
      pme_id: a.pmeId, date: a.date, qte: Number(a.qte), detail: a.detail || [],
      designation: a.designation?.trim() || '', unite: a.unite?.trim() || 'sacs',
      prix_unitaire: hasPrice ? Number(a.prixUnitaire) : null,
      devise: hasPrice ? a.devise : null,
    }
    const { data, error } = a.id
      ? await supabase.from('achats').update(payload).eq('id', a.id).select().single()
      : await supabase.from('achats').insert(payload).select().single()
    if (error) { reportError(error); return }
    setAchats(current => a.id ? current.map(item => item.id === a.id ? toAchat(data) : item) : [...current, toAchat(data)])
    setAchatFor(null); setNotice('')
  }
  const delAchat = async (id) => {
    if (!canDeletePurchase || !confirm('Supprimer cet achat ?')) return
    const { error } = await supabase.from('achats').delete().eq('id', id)
    if (error) { reportError(error); return }
    setAchats(current => current.filter(a => a.id !== id))
  }
  const updatePurchaseStatus = async (purchase, status) => {
    if (!canValidatePurchases || !['EN_ATTENTE', 'VALIDE', 'ANNULE'].includes(status)) return
    const { data, error } = await supabase.from('achats').update({ status }).eq('id', purchase.id).select().single()
    if (error) { reportError(error); return }
    setAchats(current => current.map(item => item.id === purchase.id ? toAchat(data) : item))
    setNotice(`Achat ${status === 'VALIDE' ? 'validé' : status === 'ANNULE' ? 'annulé' : 'remis en attente'}.`)
  }
  const saveMoratorium = async form => {
    if (!canManageMoratoria || moratoriumSubmissionLock.current) return
    moratoriumSubmissionLock.current = true
    setMoratoriumBusy(true)
    let uploadedPath = ''
    try {
      if (form.file) {
        const extension = form.file.name.split('.').pop()?.toLowerCase() || ''
        const safeName = form.file.name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-100)
        const uniquePart = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
        uploadedPath = `${form.pmeId}/${uniquePart}-${safeName || `justificatif.${extension}`}`
        const { error: uploadError } = await supabase.storage.from('pme-moratoria').upload(uploadedPath, form.file, {
          contentType: form.file.type,
          upsert: false,
        })
        if (uploadError) throw uploadError
      }
      const { data, error } = await supabase.from('pme_moratoria').insert({
        pme_id: Number(form.pmeId),
        starts_on: form.startsOn,
        expires_on: form.expiresOn,
        reason: form.reason.trim(),
        observations: form.observations.trim(),
        attachment_path: uploadedPath || null,
        attachment_name: form.file?.name || null,
      }).select().single()
      if (error) throw error
      setMoratoria(current => sortMoratoriaLatestFirst([toMoratorium(data), ...current]))
      setMoratoriumFormOpen(false)
      setMoratoriumNotice(`Moratoire enregistré pour ${pmes.find(pme => pme.id === Number(form.pmeId))?.nom || 'la PME'}.`)
    } catch (error) {
      if (uploadedPath) {
        const { error: cleanupError } = await supabase.storage.from('pme-moratoria').remove([uploadedPath])
        if (cleanupError) {
          setMoratoriumNotice(`Le moratoire n’a pas été enregistré (${error.message}) et le justificatif temporaire n’a pas pu être supprimé (${cleanupError.message}).`)
          setMoratoriumBusy(false)
          return
        }
      }
      setMoratoriumNotice(`Impossible d’enregistrer le moratoire : ${error.message}`)
    } finally {
      moratoriumSubmissionLock.current = false
      setMoratoriumBusy(false)
    }
  }
  const openMoratoriumAttachment = async moratorium => {
    if (!moratorium.attachmentPath) return
    const newWindow = window.open('about:blank', '_blank')
    if (!newWindow) {
      setNotice('Autorise les fenêtres contextuelles pour ouvrir le justificatif.')
      return
    }
    newWindow.opener = null
    const { data, error } = await supabase.storage.from('pme-moratoria').createSignedUrl(moratorium.attachmentPath, 60)
    if (error) {
      newWindow.close()
      reportError(error)
      return
    }
    newWindow.location.replace(data.signedUrl)
  }
  const saveSettings = async (next) => {
    setCfg(next)
    const { error } = await supabase.from('settings').update(next).eq('id', true)
    if (error) reportError(error)
  }

  if (!supabase) return <Gate title="Configuration requise">Ajoute VITE_SUPABASE_URL et VITE_SUPABASE_PUBLISHABLE_KEY aux variables d’environnement.</Gate>
  if (verificationToken) return <PublicVerification result={verificationResult} />
  if (session === undefined) return <Gate title="Connexion à REGEDEK PME">Chargement de la session…</Gate>
  if (session && passwordRecovery) return <PasswordRecovery busy={authBusy} notice={authNotice} onSave={saveNewPassword} />
  if (!session) return <AuthScreen bootstrapAvailable={bootstrapAvailable} busy={authBusy} notice={authNotice} onSignIn={signIn} onCreateFirstAdmin={createFirstAdmin} onResetPassword={resetPassword} />
  if (!dataReady) return <Gate title="Chargement du registre">Vérification de ton accès et récupération des données…</Gate>
  if (accessError) return <Gate title="Impossible de charger le registre">Le compte est connecté, mais la vérification de son accès ou le chargement des données a échoué : {accessError}. Projet Supabase utilisé : {supabaseProjectHost}. Vérifie que les migrations et le cache de schéma sont à jour dans ce projet.</Gate>
  if (!role) return <AccessDenied notice={authNotice} onSignOut={signOut} />

  const exportCsv = () => {
    const h = ['N° PME','Entreprise','Catégorie','Statut du dossier PME','Statut d’autorisation REGEDEK','Référence autorisation','Date délivrance','Expiration décision','Statut échéance historique','Date agrément','Expiration agrément','Statut ministériel','Téléphone','Adresse','Communes','Dernier achat','Total sacs','Activité']
    const l = filtered.map(r => [r.numero, r.nom, r.type, DOSSIER_LABELS[r.dossierStatus], AUTH_LABELS[r.authorizationStatus], r.authorizationReference || r.numAut, r.authorizationIssueDate || r.dateAut, r.authorizationExpiryDate || r.expAut, r.sAut.label, r.dateAgr, r.expAgr, r.sAgr.label, r.tel, r.adresse, r.communes.join('; '), r.dernier, r.totalSacs, r.sAct.label])
    const csv = [h, ...l].map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv' })); a.download = 'pme_autorisees_regedek.csv'; a.click()
  }

  const go = (stat, field = 'fStatAut') => {
    setFStatAut(field === 'fStatAut' ? stat : '')
    setFStatMin(field === 'fStatMin' ? stat : '')
    setFDossierStatus(''); setFAuthorizationStatus('')
    setQ(''); setFType(''); setFCommune(''); setFYear(''); setFTransaction(''); setFRenewal(''); setFIncomplete(false)
    setTab('pme')
  }

  const showIncomplete = () => {
    go('')
    setFIncomplete(true)
  }
  const goDossier = status => { setFDossierStatus(status); setFAuthorizationStatus(''); setFStatAut(''); setFStatMin(''); setQ(''); setFType(''); setFCommune(''); setFYear(''); setFTransaction(''); setFRenewal(''); setFIncomplete(false); setTab('pme') }
  const goAuthorization = status => { setFAuthorizationStatus(status); setFDossierStatus(''); setFStatAut(''); setFStatMin(''); setQ(''); setFType(''); setFCommune(''); setFYear(''); setFTransaction(''); setFRenewal(''); setFIncomplete(false); setTab('pme') }

  const dossierDashboardCards = [
    { label: 'PME suivies', value: rows.length, onClick: () => goDossier('') },
    ...DOSSIER_STATUSES.map(status => ({
      label: DOSSIER_LABELS[status],
      value: count(row => row.dossierStatus === status),
      onClick: () => goDossier(status),
    })),
  ]
  const documentDashboardCards = [
    { label: 'Documents demandés', value: documents.filter(doc => doc.required).length, onClick: showIncomplete },
    { label: 'Documents reçus', value: documents.filter(doc => Boolean(doc.path)).length, onClick: showIncomplete },
    { label: 'Documents validés', value: documents.filter(doc => doc.status === 'VALIDE').length, onClick: showIncomplete },
    { label: 'Manquants ou rejetés', value: documents.filter(doc => doc.required && ['MANQUANT', 'REJETE'].includes(doc.status)).length, onClick: showIncomplete },
    { label: 'En attente de vérification', value: documents.filter(doc => doc.status === 'EN_ATTENTE_DE_VERIFICATION').length, onClick: showIncomplete },
  ]
  const authorizationDashboardCards = AUTH_STATUSES.map(status => ({
    label: AUTH_LABELS[status],
    value: count(row => authTag(row.authorizationStatus, row.authorizationExpiryDate).label === AUTH_LABELS[status]),
    onClick: () => goAuthorization(status),
  }))
  const historicalAuthorizationCards = [
    { label: 'Dossiers PME suivis', value: rows.length, onClick: () => go('') },
    ...['Valide', 'Expiré', 'À renouveler', 'Non renseigné', 'À vérifier'].map(status => ({
      label: status === 'Valide' ? 'Autorisations en cours' : status === 'Non renseigné' ? "Dates d'expiration non renseignées" : status === 'À vérifier' ? 'Dates REGEDEK à vérifier' : `Autorisations ${status.toLowerCase()}`,
      value: count(row => row.sAut.label === status),
      onClick: () => go(status),
    })),
  ]
  const ministerialDashboardCards = ['Valide', 'Expiré', 'À renouveler', 'Non renseigné', 'À vérifier'].map(status => ({
    label: status === 'Valide' ? 'Agréments valides' : status === 'Non renseigné' ? "Dates d'agrément non renseignées" : status === 'À vérifier' ? "Dates d'agrément à vérifier" : `Agréments ${status.toLowerCase()}`,
    value: count(row => row.sAgr.label === status),
    onClick: () => go(status, 'fStatMin'),
  }))
  const qualityDashboardCards = [{
    label: 'Dossiers incomplets ou dates à vérifier',
    value: count(row => row.isIncomplete || row.sAut.label === 'À vérifier' || row.sAgr.label === 'À vérifier'),
    onClick: showIncomplete,
  }]
  const purchaseDashboardCards = [
    { label: 'Achats enregistrés', value: achats.length },
    ...dashboardPurchaseTotals.map(total => ({
      label: `Montant saisi — ${total.currency}`,
      value: `${total.amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${total.currency}`,
    })),
  ]
  const activityDashboardCards = dashboardActivityByStaff.map(item => ({ label: item.label, value: item.value }))
  const summaryExportData = filteredSummaryRows.map(row => [
    row.pme.nom,
    ({ AUTORISE: 'Autorisée', EN_ATTENTE: 'En attente', EXPIRE: 'Expirée', NON_CONFORME: 'Non autorisée' })[row.authorizationStatus],
    MORATORIUM_STATUS_LABELS[row.moratoriumStatus.code],
    row.moratoriumStatus.daysRemaining,
    row.moratorium?.expiresOn || '',
    row.trashBagQuantity,
  ])
  const exportSummaryExcel = () => {
    const blob = createXlsxBlob([{
      name: 'Tableau recapitulatif',
      headers: ['Nom de la PME', 'Statut de l’autorisation', 'Statut du moratoire', 'Jours avant expiration', 'Date de fin du moratoire', `Sacs achetés en ${summaryYear}`],
      rows: summaryExportData,
    }])
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `tableau-recapitulatif-pme-${summaryYear}.xlsx`
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const exportSummaryPdf = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      setNotice('Autorise les fenêtres contextuelles pour ouvrir l’export PDF.')
      return
    }
    const headers = ['Nom de la PME', 'Statut de l’autorisation', 'Statut du moratoire', 'Jours restants', 'Fin du moratoire', `Sacs achetés en ${summaryYear}`]
    const rows = summaryExportData.map(row => row.map(value => `<td>${xmlEscape(value == null ? '—' : value)}</td>`).join(''))
    printWindow.document.open()
    printWindow.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Tableau récapitulatif des PME</title><style>@page{size:A4 landscape;margin:14mm}body{font-family:Arial,sans-serif;color:#1d2b3a}h1{color:#102a46}p{color:#4b5c70;font-size:12px}table{width:100%;border-collapse:collapse;font-size:10px}th,td{border:1px solid #dce5ee;padding:7px;text-align:left}th{color:#fff;background:#183c63}tbody tr:nth-child(even){background:#f2f6fb}</style></head><body><h1>Tableau récapitulatif des PME</h1><p>REGEDEK PME · Données au ${xmlEscape(fmt(moratoriumToday))} · Achats validés pour l’année civile ${summaryYear}</p><table><thead><tr>${headers.map(header => `<th>${xmlEscape(header)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row}</tr>`).join('')}</tbody></table><script>window.onload=()=>window.print()</script></body></html>`)
    printWindow.document.close()
    setNotice('La fenêtre d’impression est ouverte. Choisis « Enregistrer au format PDF ».')
  }
  const sortSummaryBy = key => {
    if (summarySort === key) setSummarySortDirection(current => current === 'asc' ? 'desc' : 'asc')
    else {
      setSummarySort(key)
      setSummarySortDirection('asc')
    }
  }

  return (<>
    <header className="app-header">
      <Brand compact />
      {session && <button className="btn sec sign-out" onClick={signOut}>Se déconnecter</button>}
    </header>
    <div className="app-navigation">
      <nav aria-label="Navigation principale">
        {[['dash', 'Tableau de bord'], ['pme', 'PME AUTORISÉES'], ...(canReadSummary ? [['summary', 'TABLEAU RÉCAPITULATIF']] : []), ...(canArchivePme ? [['archived', 'PME archivées']] : []), ['achats', 'Achats'], ...(canManageStaff ? [['users', 'Utilisateurs']] : []), ...(canReadActivities ? [['activity', 'Activités']] : []), ...(canReadReports ? [['reports', 'Rapports']] : []), ['cfg', 'Réglages']].map(([k, l]) =>
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => { setTab(k); if (k === 'activity') setUnreadActivityCount(0); if (k !== 'pme') { setFStatAut(''); setFStatMin('') } }}>
            {l}{k === 'activity' && unreadActivityCount > 0 && <span className="activity-count">{unreadActivityCount}</span>}
          </button>)}
      </nav>
    </div>
    <main>
      {notice && <p role="alert" className="notice">{notice}</p>}
      {activityNotification && <p className="activity-notification" role="status">{activityNotification}<button className="btn sec" onClick={() => setActivityNotification('')}>Fermer</button></p>}
      {tab === 'dash' && <>
        <div className="dashboard-period-toolbar">
          <p>Statistiques réelles du registre; les achats se mettent à jour automatiquement.</p>
          <label className="period-filter">Regrouper les évolutions par
            <select value={dashboardPeriod} onChange={event => setDashboardPeriod(event.target.value)}>
              <option value="day">Jour — 14 derniers jours</option>
              <option value="month">Mois — 12 derniers mois</option>
              <option value="year">Année — 5 dernières années</option>
            </select>
          </label>
        </div>
        <DashboardStatSection
          title="Suivi administratif des dossiers PME"
          cards={dossierDashboardCards}
          note={`Répartition : ${DOSSIER_STATUSES.reduce((sum, status) => sum + count(row => row.dossierStatus === status), 0)} / ${rows.length}. La complétude du dossier n’accorde jamais automatiquement une autorisation REGEDEK.`}
          chart={<div className="dashboard-chart-stack">
            <HorizontalBarChart title="Répartition par statut du dossier" data={dossierDashboardCards.slice(1).map(card => ({ label: card.label, value: card.value }))} />
            <TrendBarChart title="Évolution des enregistrements PME" data={dashboardPmeTrend} />
          </div>}
        />
        <DashboardStatSection
          title="Documents administratifs"
          cards={documentDashboardCards}
          chart={<HorizontalBarChart title="Répartition des documents" data={documentDashboardCards.map(card => ({ label: card.label, value: card.value }))} />}
        />
        <DashboardStatSection
          title="Situation réglementaire REGEDEK"
          cards={authorizationDashboardCards}
          note={`Répartition : ${AUTH_STATUSES.reduce((sum, status) => sum + count(row => authTag(row.authorizationStatus, row.authorizationExpiryDate).label === AUTH_LABELS[status]), 0)} / ${rows.length}. L’autorisation n’est attribuée qu’après une décision enregistrée par un utilisateur habilité.`}
          chart={<HorizontalBarChart title="PME par décision réglementaire" data={authorizationDashboardCards.map(card => ({ label: card.label, value: card.value }))} />}
        />
        <DashboardStatSection
          title="Anciennes échéances REGEDEK et agréments ministériels"
          cards={historicalAuthorizationCards}
          note={`Parmi les dossiers sans échéance, ${horsRegistre} proviennent uniquement d’achats ou d’enquêtes et ${registreSansEcheance} sont de source registre sans date d’expiration.`}
          chart={<HorizontalBarChart title="Échéances REGEDEK historiques" data={historicalAuthorizationCards.slice(1).map(card => ({ label: card.label, value: card.value }))} />}
        />
        <DashboardStatSection
          title="Agréments ministériels"
          cards={ministerialDashboardCards}
          chart={<HorizontalBarChart title="Statut des agréments ministériels" data={ministerialDashboardCards.map(card => ({ label: card.label, value: card.value }))} />}
        />
        <DashboardStatSection
          title="Qualité des dossiers"
          cards={qualityDashboardCards}
          chart={<HorizontalBarChart title="Dossiers à vérifier" data={qualityDashboardCards.map(card => ({ label: card.label, value: card.value }))} />}
        />
        <DashboardStatSection
          title="Achats"
          cards={purchaseDashboardCards}
          chart={<div className="dashboard-chart-stack">
            <TrendBarChart title="Évolution du nombre d’achats" data={dashboardPurchaseTrend} />
            {dashboardAmountTrends.length
              ? dashboardAmountTrends.map(series => <TrendBarChart key={series.currency} title={`Évolution des montants — ${series.currency}`} data={series.data} format={value => value.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} note="Les devises ne sont pas additionnées." />)
              : <section className="dashboard-chart"><h3>Montants d’achats</h3><p className="chart-empty">Aucun prix saisi; aucun montant n’est estimé à partir des quantités.</p></section>}
          </div>}
        />
        {canReadActivities && <DashboardStatSection
          title="Activités des administrateurs"
          cards={activityDashboardCards}
          note={dashboardActivityBusy ? 'Actualisation des activités…' : `${dashboardActivities.length.toLocaleString('fr-FR')} activités chargées pour la période choisie.`}
          chart={<div className="dashboard-chart-stack">
            <HorizontalBarChart title="Activités par administrateur" data={dashboardActivityByStaff} />
            <TrendBarChart title="Évolution des activités" data={dashboardActivityTrend} />
          </div>}
        />}
        <h2>À surveiller</h2>
        <Table
          rows={rows.filter(r => r.authorizationStatus !== 'AUTORISE' || r.dossierStatus !== 'VALIDE_ADMINISTRATIVEMENT' || documentStats(r.id).missing > 0 || r.sAut.label !== 'Valide' || r.sAgr.label !== 'Valide' || r.isIncomplete || r.sAct.label !== 'Active')}
          onOpen={setDetail}
          onEdit={pme => setEdit(pme)}
          onArchive={pme => setPmeArchived(pme, true)}
          canEdit={canEdit}
          canArchive={canArchivePme}
        />
        {canReadActivities && <section className="recent-activity">
          <div className="row"><h2>Activités récentes</h2><button className="btn sec" onClick={() => setTab('activity')}>Consulter le journal</button></div>
          <ActivityEntries rows={recentActivities} />
        </section>}
      </>}

      {tab === 'pme' && <>
        <div className="bar filters">
          <input placeholder="Recherche par N° PME, entreprise, autorisation ou téléphone" value={q} onChange={e => setQ(e.target.value)} />
          <select value={fType} onChange={e => setFType(e.target.value)}>
            <option value="">Catégorie</option>
            {[...new Set(rows.map(r => r.type).filter(Boolean))].sort().map(v => <option key={v} value={v}>{v}</option>)}
          </select>
          <select value={fCommune} onChange={e => setFCommune(e.target.value)}>
            <option value="">Commune</option>
            {communeOptions.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
          <select value={fStatAut} onChange={e => setFStatAut(e.target.value)}>
            <option value="">Échéance historique REGEDEK</option>
            {['Valide', 'À renouveler', 'Expiré', 'Non renseigné', 'À vérifier'].map(s => <option key={s}>{s}</option>)}
          </select>
          <select aria-label="Statut du dossier PME" value={fDossierStatus} onChange={e => setFDossierStatus(e.target.value)}>
            <option value="">Statut du dossier PME</option>
            {DOSSIER_STATUSES.map(s => <option key={s} value={s}>{DOSSIER_LABELS[s]}</option>)}
          </select>
          <select aria-label="Statut d'autorisation REGEDEK" value={fAuthorizationStatus} onChange={e => setFAuthorizationStatus(e.target.value)}>
            <option value="">Décision d'autorisation</option>
            {AUTH_STATUSES.map(s => <option key={s} value={s}>{AUTH_LABELS[s]}</option>)}
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
          {canCreatePme && <button className="btn" onClick={() => setEdit({ ...VIDE })}>+ Nouvelle PME</button>}
          {hasPermission('reports.read') && <button className="btn sec" onClick={exportCsv}>Exporter CSV</button>}
        </div>
        <Table
          rows={filtered}
          onOpen={setDetail}
          onEdit={pme => setEdit(pme)}
          onArchive={pme => setPmeArchived(pme, true)}
          canEdit={canEdit}
          canArchive={canArchivePme}
        />
      </>}

      {tab === 'archived' && canArchivePme && <ArchivedPmeTable rows={archivedPmes} onRestore={pme => setPmeArchived(pme, false)} />}

      {tab === 'summary' && canReadSummary && <section className="pme-summary">
        <div className="row summary-heading">
          <div><h2>TABLEAU RÉCAPITULATIF DES PME</h2><p>Échéances calculées au {fmt(moratoriumToday)} · achats de sacs validés en {summaryYear} (année de Kinshasa).</p></div>
          <div className="row summary-actions">
            <button className="btn sec" onClick={exportSummaryPdf}>Exporter PDF</button>
            <button className="btn sec" onClick={exportSummaryExcel}>Exporter Excel</button>
            {canManageMoratoria && <button className="btn" disabled={!pmes.length} onClick={() => { setMoratoriumNotice(''); setMoratoriumFormOpen(true) }}>Attribuer un moratoire</button>}
          </div>
        </div>
        {moratoriumNotice && <p role="status" className="notice">{moratoriumNotice}</p>}
        <div className="bar filters summary-filters">
          <input aria-label="Rechercher une PME" placeholder="Rechercher par nom de PME" value={summaryQuery} onChange={event => setSummaryQuery(event.target.value)} />
          <select aria-label="Filtrer par statut d’autorisation" value={summaryAuthorizationFilter} onChange={event => setSummaryAuthorizationFilter(event.target.value)}>
            <option value="">Tous les statuts d’autorisation</option>
            <option value="AUTORISE">Autorisée</option><option value="EN_ATTENTE">En attente</option><option value="EXPIRE">Expirée</option><option value="NON_CONFORME">Non autorisée</option>
          </select>
          <select aria-label="Filtrer par statut du moratoire" value={summaryMoratoriumFilter} onChange={event => setSummaryMoratoriumFilter(event.target.value)}>
            <option value="">Tous les statuts du moratoire</option>
            {Object.entries(MORATORIUM_STATUS_LABELS).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
          </select>
          <select aria-label="Trier le tableau" value={`${summarySort}:${summarySortDirection}`} onChange={event => { const [key, direction] = event.target.value.split(':'); setSummarySort(key); setSummarySortDirection(direction) }}>
            <option value="name:asc">Trier par nom (A–Z)</option><option value="name:desc">Trier par nom (Z–A)</option>
            <option value="expiry:asc">Expiration du moratoire (plus proche)</option><option value="expiry:desc">Expiration du moratoire (plus éloignée)</option>
            <option value="bags:desc">Achats de sacs (plus nombreux)</option><option value="bags:asc">Achats de sacs (moins nombreux)</option>
          </select>
        </div>
        <div className="tw summary-table-wrap"><table className="summary-table">
          <thead><tr><th>Nom de la PME</th><th>Statut de l’autorisation</th><th>Statut du moratoire</th><th><button className="table-sort" onClick={() => sortSummaryBy('expiry')}>Jours restants · expiration</button></th><th><button className="table-sort" onClick={() => sortSummaryBy('bags')}>Sacs achetés en {summaryYear}</button></th><th>Actions</th></tr></thead>
          <tbody>{filteredSummaryRows.map(row => <tr key={row.pme.id}>
            <td><button className="summary-company-link" onClick={() => setDetail(row.pme)}>{row.pme.nom}</button></td>
            <td><Tag s={{ label: ({ AUTORISE: 'Autorisée', EN_ATTENTE: 'En attente', EXPIRE: 'Expirée', NON_CONFORME: 'Non autorisée' })[row.authorizationStatus], cls: ({ AUTORISE: 'vert', EN_ATTENTE: 'orange', EXPIRE: 'rouge', NON_CONFORME: 'rouge' })[row.authorizationStatus] }} /></td>
            <td><Tag s={{ label: MORATORIUM_STATUS_LABELS[row.moratoriumStatus.code], cls: MORATORIUM_STATUS_COLORS[row.moratoriumStatus.code] }} />{row.moratorium && <small className="summary-date">Du {fmt(row.moratorium.startsOn)} au {fmt(row.moratorium.expiresOn)}</small>}</td>
            <td>{!row.moratorium ? '—' : row.moratoriumStatus.daysRemaining < 0 ? `Expiré depuis ${Math.abs(row.moratoriumStatus.daysRemaining)} j` : row.moratoriumStatus.code === 'upcoming' ? `Débute dans ${row.moratoriumStatus.daysUntilStart} j` : `${row.moratoriumStatus.daysRemaining} j`}</td>
            <td>{row.trashBagQuantity.toLocaleString('fr-FR')}</td>
            <td><div className="row summary-row-actions">
              {row.moratorium && <button className="btn sec" onClick={() => setMoratoriumHistoryPme(row.pme)}>Historique</button>}
              {row.moratorium?.attachmentPath && <button className="btn sec" onClick={() => openMoratoriumAttachment(row.moratorium)}>Justificatif</button>}
            </div></td>
          </tr>)}</tbody>
        </table></div>
        {!filteredSummaryRows.length && <p className="summary-empty">Aucune PME ne correspond aux filtres.</p>}
        <p className="metric-note">Seuls les achats validés dont la désignation identifie des sacs-poubelle et dont l’unité est « sac(s) » sont comptés. Les achats annulés et les anciennes désignations non renseignées sont exclus. L’historique des années précédentes est conservé.</p>
      </section>}

      {tab === 'achats' && <>
        <div className="bar">{canCreatePurchase && <button className="btn" onClick={() => setAchatFor({ pmeId: pmes[0]?.id, date: new Date().toISOString().slice(0, 10), qte: '', designation: '', unite: 'sacs', prixUnitaire: '', devise: 'CDF' })}>+ Enregistrer un achat</button>}</div>
        <div className="tw"><table><thead><tr><th>Date</th><th>PME</th><th>Produit / service</th><th>Quantité</th><th>Montant</th><th>Statut</th><th></th></tr></thead><tbody>
          {[...achats].sort((a, b) => b.date.localeCompare(a.date)).map(a => <tr key={a.id}>
            <td>{fmt(a.date)}</td><td>{rows.find(p => p.id === a.pmeId)?.numero ?? '—'} — {[...pmes, ...archivedPmes].find(p => p.id === a.pmeId)?.nom || '?'}</td><td>{a.designation || '—'}</td>
            <td>{Number(a.qte).toLocaleString('fr')} {a.unite || 'sacs'}</td><td>{a.montantTotal == null ? '—' : `${Number(a.montantTotal).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${a.devise}`}</td>
            <td><Tag s={{ label: PURCHASE_STATUS_LABELS[a.status], cls: PURCHASE_STATUS_COLORS[a.status] }} /></td>
            <td>{(canUpdatePurchase || canDeletePurchase || canValidatePurchases) && <div className="row">
              {canValidatePurchases && a.status !== 'VALIDE' && <button className="btn sec" onClick={() => updatePurchaseStatus(a, 'VALIDE')}>Valider</button>}
              {canValidatePurchases && a.status !== 'ANNULE' && <button className="btn sec" onClick={() => updatePurchaseStatus(a, 'ANNULE')}>Annuler</button>}
              {canUpdatePurchase && <button className="btn sec" onClick={() => setAchatFor(a)}>Modifier</button>}
              {canDeletePurchase && <button className="btn sec" onClick={() => delAchat(a.id)}>Suppr.</button>}
            </div>}</td></tr>)}
        </tbody></table></div>
      </>}

      {tab === 'users' && canManageStaff && <StaffManager
        users={staffUsers}
        busy={staffUsersBusy}
        onRoleChange={changeStaffRole}
        onPermissionChange={changeCustomPermission}
        onInvite={inviteStaff}
      />}

      {tab === 'activity' && canReadActivities && <ActivityLog
        rows={activityRows}
        busy={activityBusy}
        filters={activityFilters}
        onChange={setActivityFilters}
      />}

      {tab === 'reports' && canReadReports && <ReportCenter
        pmes={[...pmes, ...archivedPmes]}
        achats={achats}
        documents={documents}
      />}

      {tab === 'cfg' && <div className="box" style={{ margin: 0 }}>
        <h2>Règles de statut</h2>
        <div className="grid">
          <div><label>Alerte « À renouveler » (jours avant expiration)</label><input type="number" value={cfg.alerte} disabled={!hasPermission('settings.update')} onChange={e => saveSettings({ ...cfg, alerte: +e.target.value })} /></div>
          <div><label>PME « Inactive » après (jours sans achat)</label><input type="number" value={cfg.inactif} disabled={!hasPermission('settings.update')} onChange={e => saveSettings({ ...cfg, inactif: +e.target.value })} /></div>
        </div>
        {!hasPermission('settings.update') && <p>Seul un utilisateur autorisé peut modifier ces règles.</p>}
      </div>}
    </main>

    {edit && <PmeForm p={edit} onSave={savePme} onClose={() => setEdit(null)} />}
    {achatFor && <AchatForm a={achatFor} pmes={pmes} onSave={saveAchat} onClose={() => setAchatFor(null)} />}
    {moratoriumFormOpen && <MoratoriumForm pmes={pmes} today={moratoriumToday} busy={moratoriumBusy} onSave={saveMoratorium} onClose={() => setMoratoriumFormOpen(false)} />}
    {moratoriumHistoryPme && <MoratoriumHistory
      pme={moratoriumHistoryPme}
      rows={moratoria.filter(item => item.pmeId === moratoriumHistoryPme.id)}
      today={moratoriumToday}
      onOpenAttachment={openMoratoriumAttachment}
      onClose={() => setMoratoriumHistoryPme(null)}
    />}
      {detail && (() => { const r = rows.find(x => x.id === detail.id); if (!r) return null; const pmeDocs = documents.filter(d => d.pmeId === r.id); const pmeInspections = inspections.filter(x => x.pmeId === r.id); const dossierEvents = dossierHistory.filter(h => h.pme_id === r.id); const authorizationEvents = authorizationHistory.filter(h => h.pme_id === r.id); const docStats = documentStats(r.id); return (
      <div className="modal" onClick={() => setDetail(null)}><div className={`box detail${isAuthorizationExpired(r.authorizationStatus, r.authorizationExpiryDate) ? ' pme-expired-detail' : ''}`} onClick={e => e.stopPropagation()}>
        <h2>PME n° {r.numero} — {r.nom} <small>({r.type || '—'})</small></h2>
        <div className="status-summary"><div><span>STATUT DU DOSSIER PME</span><Tag s={dossierTag(r.dossierStatus)} /></div><div><span>STATUT D'AUTORISATION REGEDEK</span><Tag s={authTag(r.authorizationStatus, r.authorizationExpiryDate)} /></div></div>
        <p><strong>Contact :</strong> {r.contact || '—'} · <strong>Tél :</strong> {r.tel || '—'} · <strong>E-mail :</strong> {r.email || '—'}<br />
          <strong>Adresse :</strong> {r.adresse || '—'}<br />
          <strong>Communes :</strong> {r.communes.join(', ') || '—'}<br />
          <strong>Quartiers :</strong> {r.quartiers || '—'}<br />
          <strong>Statut juridique :</strong> {r.statutJuridique || '—'} · <strong>Source :</strong> {r.source || '—'}{r.note && <><br /><b>⚠ {r.note}</b></>}</p>
        <h2 className="subhead">Situation réglementaire et autorisation REGEDEK</h2>
        <div className={`decision-banner ${isAuthorizationExpired(r.authorizationStatus, r.authorizationExpiryDate) ? 'decision-expire' : `decision-${r.authorizationStatus?.toLowerCase()}`}`}><strong>{r.authorizationStatus === 'AUTORISE' && r.authorizationExpiryDate >= todayKinshasa() ? 'CETTE ENTREPRISE EST OFFICIELLEMENT AUTORISÉE PAR LA REGEDEK' : isAuthorizationExpired(r.authorizationStatus, r.authorizationExpiryDate) ? "L'AUTORISATION DE CETTE ENTREPRISE EST EXPIRÉE" : r.authorizationStatus === 'NON_CONFORME' ? 'CETTE ENTREPRISE EST DÉCLARÉE NON CONFORME' : AUTH_LABELS[r.authorizationStatus]}</strong></div>
        <p><strong>Référence :</strong> {r.authorizationReference || '—'} · <strong>Délivrée le :</strong> {fmt(r.authorizationIssueDate)} · <strong>Expire le :</strong> {fmt(r.authorizationExpiryDate)}<br />
          <strong>Agent responsable :</strong> {r.authorizationAgentId || 'Non renseigné'} · <strong>Dernière mise à jour :</strong> {r.authorizationUpdatedAt ? new Date(r.authorizationUpdatedAt).toLocaleString('fr-FR') : '—'}<br />
          <strong>Signataire :</strong> {r.authoritySignerName || '—'} · {r.authoritySignerTitle || '—'}<br />
          <strong>Observations :</strong> {r.authorizationObservations || '—'}{r.nonComplianceReason && <><br /><strong>Motif de non-conformité :</strong> {r.nonComplianceReason}</>}
        </p>
        {r.authorizationStatus === 'AUTORISE' && <button className="btn certificate-button" disabled={authTag(r.authorizationStatus, r.authorizationExpiryDate).label !== 'Autorisé' || !r.authorizationReference || !r.authorizationIssueDate || !r.authoritySignerName || !r.authoritySignerTitle} onClick={() => openCertificate(r)}>Attestation d'autorisation · imprimer / PDF</button>}
        {canManageAuthorization && <AuthorizationEditor pme={r} onSave={patch => saveAuthorization(r.id, patch)} />}
        <h2 className="subhead">Suivi administratif du dossier</h2>
        <p>{docStats.asked} documents demandés · {docStats.received} reçus · {docStats.approved} validés · {docStats.pending} en attente de vérification · {docStats.missing} manquants ou rejetés<br />
          <strong>Observations :</strong> {r.dossierObservations || '—'} · <strong>Mis à jour :</strong> {r.dossierUpdatedAt ? new Date(r.dossierUpdatedAt).toLocaleString('fr-FR') : '—'} · <strong>Agent :</strong> {r.dossierUpdatedBy || '—'}</p>
        {canManageDossier && <DossierEditor pme={r} onSave={patch => saveDossier(r.id, patch)} />}
        <DocumentManager documents={pmeDocs} canManage={canManageDocuments} canUpload={hasPermission('document.upload')} canReview={canReviewDocuments} canDelete={canDeleteDocuments} onSave={saveDocument} onReview={reviewDocument} onOpen={openDocument} onPreview={getDocumentUrl} onDelete={deleteDocument} onUpdate={updateDocumentObservations} />
        <h2 className="subhead">Historique du dossier et des documents</h2>
        {dossierEvents.length ? <ul className="history-list">{dossierEvents.map(h => <li key={h.id}><strong>{h.event_type}</strong> · {h.old_status || '—'} → {h.new_status || '—'} · {new Date(h.created_at).toLocaleString('fr-FR')} · utilisateur {h.actor_id || 'système'}{h.observations ? ` · ${h.observations}` : ''}</li>)}</ul> : <p>Aucun événement documentaire enregistré.</p>}
        <h2 className="subhead">Historique des décisions d'autorisation</h2>
        {authorizationEvents.length ? <ul className="history-list">{authorizationEvents.map(h => <li key={h.id}><strong>{AUTH_LABELS[h.old_status] || '—'} → {AUTH_LABELS[h.new_status] || h.new_status}</strong> · {new Date(h.created_at).toLocaleString('fr-FR')} · utilisateur {h.actor_id || 'système'} · {h.reason || '—'} · référence {h.authorization_reference || '—'}</li>)}</ul> : <p>Aucune décision enregistrée.</p>}
        <h2 className="subhead">Rapports d'inspection</h2>
        {r.authorizationStatus === 'EN_ATTENTE_INSPECTION' && canCreateInspection && <InspectionForm onSave={report => saveInspection(r.id, report)} />}
        {pmeInspections.length ? <ul className="history-list">{pmeInspections.map(report => <li key={report.id}><strong>{({ CONFORME: 'Conforme', NON_CONFORME: 'Non conforme', REINSPECTION_REQUISE: 'Nouvelle inspection requise' })[report.result]}</strong> · {fmt(report.date)} · agent {report.inspectorId || '—'} · {report.observations}</li>)}</ul> : <p>Aucun rapport d'inspection enregistré.</p>}
        <p><strong>Autorisation historique :</strong> {r.numAut || '—'} · {fmt(r.dateAut)} → {fmt(r.expAut)} <Tag s={r.sAut} /><br />
          <strong>Agrément ministère :</strong> {fmt(r.dateAgr)} → {fmt(r.expAgr)} <Tag s={r.sAgr} /><br />
          <strong>Transaction :</strong> {r.transaction} · <strong>Historique :</strong> {r.nbAutorisations || 1} enregistrement(s)<br />
          <strong>Activité :</strong> <Tag s={r.sAct} /> {r.sAct.jours !== null && `(dernier achat il y a ${r.sAct.jours} j)`}
        </p>
        <section className="purchase-detail">
          <h2 className="subhead">Achats ({r.totalSacs.toLocaleString('fr')} sacs)</h2>
          {r.mine.length ? <ul>{r.mine.map(a => <li key={a.id}>{fmt(a.date)} : {Number(a.qte).toLocaleString('fr')} sacs</li>)}</ul> : <p>Aucun achat.</p>}
        </section>
        <div className="row">
          {canArchivePme && <button className="btn red" onClick={() => setPmeArchived(r, true)}>Archiver la PME</button>}
          {canCreatePurchase && <button className="btn sec" onClick={() => { setDetail(null); setAchatFor({ pmeId: r.id, date: new Date().toISOString().slice(0, 10), qte: '' }) }}>+ Achat</button>}
          {canEdit && <button className="btn" onClick={() => { setDetail(null); setEdit(pmes.find(p => p.id === r.id)) }}>Modifier</button>}
        </div>
      </div></div>) })()}
    {certificate && <Certificate certificate={certificate} onClose={() => setCertificate(null)} />}
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

function PublicVerification({ result }) {
  return <main className="verification-page"><section className="verification-card">
    <Brand />
    <span className="eyebrow">VÉRIFICATION PUBLIQUE</span>
    <h1>Authenticité de l'autorisation REGEDEK</h1>
    {result === undefined ? <p>Vérification en cours…</p> : result?.error ? <p role="alert">Vérification indisponible : {result.error}</p> : !result ? <p className="decision-banner decision-non_conforme">Aucune autorisation correspondant à ce code n'a été trouvée.</p> : <>
      <p className={`decision-banner ${result.is_valid ? 'decision-autorise' : 'decision-expire'}`}><strong>{result.is_valid ? 'AUTORISATION VALIDE' : result.authorization_status === 'AUTORISE' || result.authorization_status === 'EXPIRE' ? 'AUTORISATION EXPIRÉE' : AUTH_LABELS[result.authorization_status] || 'AUTORISATION NON VALIDE'}</strong></p>
      <dl><dt>Entreprise</dt><dd>{result.company_name}</dd><dt>Référence</dt><dd>{result.authorization_reference || '—'}</dd><dt>Activité</dt><dd>{result.activity || '—'}</dd><dt>Délivrée le</dt><dd>{fmt(result.issue_date)}</dd><dt>Expire le</dt><dd>{fmt(result.expiry_date)}</dd></dl>
      <p className="metric-note">Cette page confirme uniquement le statut et les références publiques de l'autorisation. Elle ne donne accès à aucun document ni coordonnée privée.</p>
    </>}
  </section></main>
}

function Certificate({ certificate, onClose }) {
  const p = certificate.pme
  return <div className="certificate-overlay"><article className="certificate-page">
    <div className="certificate-heading"><img src="/favicon.png" alt="Logo REGEDEK" /><div><span>RÉGIE DE GESTION DES DÉCHETS DE KINSHASA</span><strong>ATTESTATION D'AUTORISATION</strong><small>Autorisation officielle REGEDEK</small></div></div>
    <p>La REGEDEK atteste que l'entreprise ci-dessous a reçu une autorisation officielle dans les conditions et pour la période indiquées.</p>
    <dl><dt>Entreprise</dt><dd>{p.nom}</dd><dt>Identifiant PME</dt><dd>{p.numero}</dd><dt>Référence de l'autorisation</dt><dd>{p.authorizationReference}</dd><dt>Activité concernée</dt><dd>{p.type || '—'}</dd><dt>Date de délivrance</dt><dd>{fmt(p.authorizationIssueDate)}</dd><dt>Date d'expiration</dt><dd>{fmt(p.authorizationExpiryDate)}</dd></dl>
    <div className="certificate-footer"><div><span>Autorité signataire enregistrée</span><strong>{p.authoritySignerName}</strong><small>{p.authoritySignerTitle}</small><small>Référence de vérification : {p.verificationToken}</small></div><div><img src={certificate.qrUrl} alt="QR code de vérification de l'autorisation" /><small>Scanner pour vérifier la validité</small></div></div>
    <div className="certificate-actions"><button className="btn" onClick={() => window.print()}>Imprimer / enregistrer en PDF</button><button className="btn sec" onClick={onClose}>Fermer</button></div>
  </article></div>
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

function Table({ rows, onOpen, onEdit, onArchive, canEdit, canArchive }) {
  return <div className="tw"><table className="pme-table"><thead><tr>
    <th>N° PME</th><th>Entreprise</th><th>Catégorie</th><th>Statut du dossier</th><th>Autorisation REGEDEK</th><th>Décision réglementaire</th><th>Échéance REGEDEK historique</th><th>Statut ministériel</th><th>Expiration ministérielle</th><th>Téléphone</th><th>Actions</th>
  </tr></thead><tbody>
    {rows.map(r => <tr key={r.id} className={`cl${isAuthorizationExpired(r.authorizationStatus, r.authorizationExpiryDate) ? ' pme-expired-row' : ''}`} onClick={() => onOpen(r)}>
      <td data-label="N° PME"><b>{r.numero}</b></td>
      <td data-label="Entreprise"><b>{r.nom}</b></td>
      <td data-label="Catégorie">{r.type || '—'}</td>
      <td data-label="Statut du dossier"><Tag s={dossierTag(r.dossierStatus)} /></td>
      <td data-label="N° autorisation REGEDEK">{r.authorizationReference || r.numAut || '—'}</td>
      <td data-label="Décision réglementaire"><Tag s={authTag(r.authorizationStatus, r.authorizationExpiryDate)} /></td>
      <td data-label="Échéance REGEDEK historique">{fmt(r.expAut)}</td>
      <td data-label="Statut ministériel"><Tag s={r.sAgr} /></td>
      <td data-label="Expiration ministérielle">{fmt(r.expAgr)}</td>
      <td data-label="Téléphone">{r.tel || '—'}</td>
      <td data-label="Actions">
        <div className="row">
          <button className="btn sec" onClick={(e) => { e.stopPropagation(); onOpen(r) }}>Voir</button>
          {canEdit && <button className="btn" onClick={(e) => { e.stopPropagation(); onEdit(r) }}>Modifier</button>}
          {canArchive && <button className="btn red" onClick={(e) => { e.stopPropagation(); onArchive(r) }}>Archiver</button>}
        </div>
      </td>
    </tr>)}
    {!rows.length && <tr><td colSpan="11">Aucun résultat.</td></tr>}
  </tbody></table></div>
}

function ArchivedPmeTable({ rows, onRestore }) {
  return <section>
    <h2>PME archivées</h2>
    <p>Les PME archivées sont retirées du registre actif, mais leurs achats, documents et historiques sont conservés.</p>
    <div className="tw"><table className="pme-table"><thead><tr>
      <th>Entreprise</th><th>Catégorie</th><th>Référence autorisation</th><th>Date d’archivage</th><th>Action</th>
    </tr></thead><tbody>
      {rows.map(pme => <tr key={pme.id}>
        <td data-label="Entreprise"><b>{pme.nom}</b></td>
        <td data-label="Catégorie">{pme.type || '—'}</td>
        <td data-label="Référence autorisation">{pme.authorizationReference || pme.numAut || '—'}</td>
        <td data-label="Date d’archivage">{pme.archivedAt ? new Date(pme.archivedAt).toLocaleString('fr-FR') : '—'}</td>
        <td data-label="Action"><button className="btn sec" onClick={() => onRestore(pme)}>Restaurer</button></td>
      </tr>)}
      {!rows.length && <tr><td colSpan="5">Aucune PME archivée.</td></tr>}
    </tbody></table></div>
  </section>
}

function DossierEditor({ pme, onSave }) {
  const [status, setStatus] = useState(pme.dossierStatus || 'DOSSIER_NON_SOUMIS')
  const [observations, setObservations] = useState(pme.dossierObservations || '')
  const [busy, setBusy] = useState(false)
  const submit = async e => { e.preventDefault(); setBusy(true); await onSave({ status, observations }); setBusy(false) }
  return <form className="admin-editor" onSubmit={submit}>
    <h3>Modifier le statut du dossier</h3>
    <div className="grid">
      <div className="full"><label>Statut documentaire</label><select value={status} onChange={e => setStatus(e.target.value)}>{DOSSIER_STATUSES.map(s => <option key={s} value={s}>{DOSSIER_LABELS[s]}</option>)}</select></div>
      <div className="full"><label>Observations administratives</label><textarea rows="3" value={observations} onChange={e => setObservations(e.target.value)} /></div>
    </div>
    <button className="btn" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer le dossier'}</button>
  </form>
}

function AuthorizationEditor({ pme, onSave }) {
  const [status, setStatus] = useState(pme.authorizationStatus || 'EN_ETUDE_ADMINISTRATIVE')
  const [reference, setReference] = useState(pme.authorizationReference || '')
  const [issueDate, setIssueDate] = useState(pme.authorizationIssueDate || '')
  const [expiryDate, setExpiryDate] = useState(pme.authorizationExpiryDate || '')
  const [observations, setObservations] = useState(pme.authorizationObservations || '')
  const [nonComplianceReason, setNonComplianceReason] = useState(pme.nonComplianceReason || '')
  const [reason, setReason] = useState('')
  const [signerName, setSignerName] = useState(pme.authoritySignerName || '')
  const [signerTitle, setSignerTitle] = useState(pme.authoritySignerTitle || '')
  const [busy, setBusy] = useState(false)
  const submit = async e => {
    e.preventDefault()
    if (status === 'AUTORISE' && (!reference || !issueDate || !expiryDate || !signerName || !signerTitle)) return alert('Référence, dates, nom et fonction du signataire sont obligatoires pour une autorisation officielle.')
    if (status === 'NON_CONFORME' && !nonComplianceReason.trim()) return alert('Le motif de non-conformité est obligatoire.')
    if (status !== pme.authorizationStatus && !reason.trim()) return alert('Le motif du changement de statut est obligatoire.')
    setBusy(true); const ok = await onSave({ status, reference, issueDate, expiryDate, observations, nonComplianceReason, reason, signerName, signerTitle }); if (ok) setReason(''); setBusy(false)
  }
  return <form className="admin-editor authorization-editor" onSubmit={submit}>
    <h3>Modifier le statut d'autorisation · utilisateurs habilités</h3>
    <div className="grid">
      <div className="full"><label>Statut réglementaire REGEDEK</label><select value={status} onChange={e => setStatus(e.target.value)}>{AUTH_STATUSES.map(s => <option key={s} value={s}>{AUTH_LABELS[s]}</option>)}</select></div>
      {(status === 'AUTORISE' || reference || issueDate || expiryDate) && <>
        <div><label>Référence de l'autorisation</label><input value={reference} onChange={e => setReference(e.target.value)} /></div>
        <div><label>Date de délivrance</label><input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} /></div>
        <div><label>Date d'expiration</label><input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} /></div>
        <div><label>Nom de l'autorité signataire</label><input value={signerName} onChange={e => setSignerName(e.target.value)} /></div>
        <div><label>Fonction du signataire</label><input value={signerTitle} onChange={e => setSignerTitle(e.target.value)} /></div>
      </>}
      {status === 'NON_CONFORME' && <div className="full"><label>Motif de non-conformité</label><textarea rows="2" value={nonComplianceReason} onChange={e => setNonComplianceReason(e.target.value)} required /></div>}
      <div className="full"><label>Observations</label><textarea rows="2" value={observations} onChange={e => setObservations(e.target.value)} /></div>
      <div className="full"><label>Motif du changement de statut</label><textarea rows="2" value={reason} onChange={e => setReason(e.target.value)} required={status !== pme.authorizationStatus} /></div>
    </div>
    <button className="btn" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer la décision'}</button>
  </form>
}

function InspectionForm({ onSave }) {
  const [result, setResult] = useState('CONFORME')
  const [observations, setObservations] = useState('')
  const [date, setDate] = useState(todayKinshasa())
  const [busy, setBusy] = useState(false)
  const submit = async e => { e.preventDefault(); if (!observations.trim()) return; setBusy(true); const ok = await onSave({ result, observations: observations.trim(), date }); if (ok) setObservations(''); setBusy(false) }
  return <form className="admin-editor inspection-editor" onSubmit={submit}>
    <h3>Ajouter un résultat d'inspection · rapport historisé</h3>
    <div className="grid">
      <div><label>Résultat</label><select value={result} onChange={e => setResult(e.target.value)}><option value="CONFORME">Conforme</option><option value="NON_CONFORME">Non conforme</option><option value="REINSPECTION_REQUISE">Nouvelle inspection requise</option></select></div>
      <div><label>Date de l'inspection</label><input type="date" value={date} onChange={e => setDate(e.target.value)} required /></div>
      <div className="full"><label>Constats et observations</label><textarea rows="3" value={observations} onChange={e => setObservations(e.target.value)} required /></div>
    </div>
    <button className="btn" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer le rapport d’inspection'}</button>
  </form>
}

function DocumentManager({ documents, canManage, canUpload, canReview, canDelete, onSave, onReview, onOpen, onPreview, onDelete, onUpdate }) {
  const [name, setName] = useState('')
  const [required, setRequired] = useState(true)
  const [files, setFiles] = useState([])
  const [previewUrls, setPreviewUrls] = useState({})
  const [uploadMessage, setUploadMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const add = async e => {
    e.preventDefault()
    const form = e.currentTarget
    const selectedFiles = files
    setBusy(true)
    setUploadMessage('')
    setFiles([])
    form.reset()
    let savedCount = 0
    try {
      if (!selectedFiles.length) {
        const saved = await onSave({ name, required }, null)
        if (saved) setName('')
        return
      }
      for (const file of selectedFiles) {
        const saved = await onSave({ name, required }, file)
        if (!saved) {
          setUploadMessage(savedCount
            ? `${savedCount} fichier(s) ont été enregistrés avant l’erreur. Le fichier en échec et les suivants restent à transmettre.`
            : 'Aucun fichier n’a été enregistré. Corrige l’erreur affichée puis réessaie.')
          return
        }
        savedCount += 1
      }
      setName('')
      setUploadMessage(`${savedCount} fichier(s) enregistré(s).`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setUploadMessage(savedCount
        ? `${savedCount} fichier(s) enregistrés avant l’erreur : ${message}. Les fichiers restants n’ont pas été traités.`
        : `Échec de l’enregistrement : ${message}.`)
    } finally {
      setBusy(false)
    }
  }
  const preview = async doc => {
    if (previewUrls[doc.id]) {
      setPreviewUrls(current => ({ ...current, [doc.id]: '' }))
      return
    }
    const url = await onPreview(doc)
    if (url) setPreviewUrls(current => ({ ...current, [doc.id]: url }))
  }
  const review = async (doc, status) => {
    const reason = status === 'REJETE' ? prompt('Motif obligatoire du rejet :') : ''
    if (status === 'REJETE' && !reason?.trim()) return
    await onReview(doc, status, reason?.trim() || '')
  }
  return <section className="documents-section">
    <h2 className="subhead">Documents demandés et transmis ({documents.length})</h2>
    {canUpload && <form className="document-upload" onSubmit={add}>
      <label>Nom du document demandé<input value={name} onChange={e => setName(e.target.value)} required /></label>
      <label className="check"><input type="checkbox" checked={required} onChange={e => setRequired(e.target.checked)} /> Document obligatoire</label>
      <label>Fichiers transmis (facultatif · PDF, Word ou image · 10 Mo maximum par fichier)<input type="file" multiple accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp" onChange={e => setFiles(Array.from(e.target.files || []))} /></label>
      <button className="btn" disabled={busy || !name.trim()}>{busy ? 'Enregistrement…' : files.length ? `Ajouter ${files.length} fichier(s)` : 'Ajouter le document demandé'}</button>
      {uploadMessage && <p role="status">{uploadMessage}</p>}
    </form>}
    {documents.length ? <div className="document-list">{documents.map(doc => <article className="document-item" key={doc.id}>
      <div><strong>{doc.name}</strong><span>{doc.required ? 'Obligatoire' : 'Facultatif'} · {doc.filename || 'Fichier non reçu'} · <Tag s={{ label: ({ MANQUANT: 'Manquant', EN_ATTENTE_DE_VERIFICATION: 'À vérifier', VALIDE: 'Validé', REJETE: 'Rejeté' })[doc.status] || doc.status, cls: ({ MANQUANT: 'rouge', EN_ATTENTE_DE_VERIFICATION: 'À vérifier', VALIDE: 'vert', REJETE: 'rouge' })[doc.status] || 'gris' }} /></span>
        {doc.observations && <small>Observation : {doc.observations}</small>}{doc.rejectionReason && <small>Motif du rejet : {doc.rejectionReason}</small>}
        {previewUrls[doc.id] && <img className="document-preview" src={previewUrls[doc.id]} alt={`Aperçu de ${doc.filename || doc.name}`} />}
      </div>
      <div className="document-actions">
        {canUpload && (!doc.path || canDelete) && <label className="upload-small">{doc.path ? 'Remplacer la pièce' : 'Transmettre le document'}<input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp" onChange={async e => {
          const file = e.target.files?.[0]
          if (file && (!doc.path || confirm(`Remplacer le fichier « ${doc.filename} » ?`))) await onSave(doc, file)
          e.target.value = ''
        }} /></label>}
        {doc.path && (doc.mime?.startsWith('image/') || /\.(jpe?g|png|webp|gif)$/i.test(doc.filename || '')) && <button className="btn sec" onClick={() => preview(doc)}>{previewUrls[doc.id] ? 'Masquer l’aperçu' : 'Aperçu image'}</button>}
        {doc.path && <button className="btn sec" onClick={() => onOpen(doc)}>Consulter / télécharger</button>}
        {canReview && doc.path && doc.status !== 'VALIDE' && <button className="btn" onClick={() => review(doc, 'VALIDE')}>Valider</button>}
        {canReview && doc.path && doc.status !== 'REJETE' && <button className="btn red" onClick={() => review(doc, 'REJETE')}>Rejeter</button>}
        {canManage && <button className="btn sec" onClick={() => { const observations = prompt('Observations du gestionnaire :', doc.observations || ''); if (observations !== null) onUpdate(doc, observations) }}>Observation</button>}
        {canDelete && <button className="btn sec" onClick={() => confirm('Supprimer ce document ?') && onDelete(doc)}>Supprimer</button>}
      </div>
    </article>)}</div> : <p>Aucun document demandé ou transmis.</p>}
  </section>
}

function StaffManager({ users, busy, onRoleChange, onPermissionChange, onInvite }) {
  const [email, setEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('agent')
  const roleLabels = { admin: 'Super Admin', agent: 'Opérateur', reader: 'Lecture seule', custom: 'Personnalisé', disabled: 'Désactivé' }
  const permissionLabels = [
    ['pme.create', 'Créer une PME'], ['pme.update', 'Modifier une PME'], ['pme.archive', 'Archiver/restaurer une PME'],
    ['pme.dossier.manage', 'Gérer le dossier'], ['pme.authorization.manage', 'Gérer autorisations/agréments'],
    ['purchase.create', 'Créer un achat'], ['purchase.update', 'Modifier un achat'], ['purchase.delete', 'Supprimer un achat'],
    ['document.upload', 'Importer des documents'], ['document.update', 'Modifier les documents'],
    ['document.review', 'Valider/rejeter les documents'], ['document.delete', 'Supprimer les documents'],
    ['inspection.create', 'Créer une inspection'], ['settings.update', 'Modifier les paramètres'],
    ['reports.read', 'Télécharger les rapports'], ['activity.read', 'Consulter les activités'],
  ]
  const invite = async event => {
    event.preventDefault()
    await onInvite({ email, role: inviteRole })
    setEmail('')
  }
  return <section className="staff-manager">
    <h2>Gestion des comptes et des rôles</h2>
    <p>Les permissions sont vérifiées par Supabase et par les règles RLS. Le compte principal `gradismith66@gmail.com` ne peut pas être rétrogradé.</p>
    <form className="bar" onSubmit={invite}>
      <input type="email" placeholder="Adresse e-mail à inviter" value={email} onChange={event => setEmail(event.target.value)} required />
      <select value={inviteRole} onChange={event => setInviteRole(event.target.value)}>
        <option value="agent">Opérateur</option>
        <option value="custom">Personnalisé (lecture seule par défaut)</option>
        <option value="reader">Lecture seule</option>
      </select>
      <button className="btn" disabled={busy}>{busy ? 'Envoi…' : 'Inviter un utilisateur'}</button>
    </form>
    <div className="tw"><table><thead><tr><th>Compte</th><th>Vérifié</th><th>Rôle</th><th>Permissions personnalisées</th></tr></thead><tbody>
      {users.map(user => <tr key={user.user_id}>
        <td data-label="Compte">{user.email}</td>
        <td data-label="Vérifié">{user.email_confirmed ? 'Oui' : 'En attente'}</td>
        <td data-label="Rôle"><select value={user.role || 'disabled'} disabled={busy || user.email?.toLowerCase() === 'gradismith66@gmail.com'} onChange={event => onRoleChange(user.email, event.target.value)}>
          {Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></td>
        <td data-label="Permissions personnalisées">
          {user.role === 'custom' ? <div className="permission-list">{permissionLabels.map(([permission, label]) => <label className="check" key={permission}>
            <input type="checkbox" checked={user.permissions?.includes(permission) || false} disabled={busy} onChange={event => onPermissionChange(user.email, permission, event.target.checked)} />
            {label}
          </label>)}</div> : user.role === 'admin' ? 'Tous les droits' : user.role === 'agent' ? 'Droits opérateur' : 'Lecture seule'}
        </td>
      </tr>)}
      {!users.length && <tr><td colSpan="4">{busy ? 'Chargement des comptes…' : 'Aucun utilisateur Auth trouvé.'}</td></tr>}
    </tbody></table></div>
  </section>
}

function ActivityEntries({ rows }) {
  if (!rows.length) return <p>Aucune activité récente enregistrée.</p>
  return <div className="activity-list">{rows.map(activity => <article className="activity-entry" key={activity.id}>
    <div><strong>{ACTIVITY_LABELS[activity.operation] || activity.operation}</strong><span>{activity.actor_name} · {activity.actor_email} · {activity.actor_role}</span></div>
    <time dateTime={activity.created_at}>{new Date(activity.created_at).toLocaleString('fr-FR')}</time>
  </article>)}</div>
}

function ActivityLog({ rows, busy, filters, onChange }) {
  const setFilter = key => event => onChange(current => ({ ...current, [key]: event.target.value }))
  const clearFilters = () => onChange({ actor: '', operation: '', from: '', to: '' })
  return <section className="activity-log">
    <h2>Journal des activités</h2>
    <p>Les opérations sont journalisées par Supabase et ne peuvent pas être modifiées depuis l’application.</p>
    <div className="bar filters">
      <input aria-label="Filtrer par adresse e-mail" placeholder="Utilisateur (adresse e-mail)" value={filters.actor} onChange={setFilter('actor')} />
      <select aria-label="Filtrer par opération" value={filters.operation} onChange={setFilter('operation')}>
        <option value="">Toutes les opérations</option>
        {Object.entries(ACTIVITY_LABELS).map(([operation, label]) => <option key={operation} value={operation}>{label}</option>)}
      </select>
      <label>Du <input type="date" value={filters.from} onChange={setFilter('from')} /></label>
      <label>Au <input type="date" value={filters.to} onChange={setFilter('to')} /></label>
      <button className="btn sec" onClick={clearFilters}>Effacer les filtres</button>
    </div>
    {busy ? <p>Chargement du journal…</p> : rows.length ? <div className="activity-list">
      {rows.map(activity => <article className="activity-entry activity-entry-detailed" key={activity.id}>
        <div className="activity-entry-main">
          <strong>{ACTIVITY_LABELS[activity.operation] || activity.operation}</strong>
          <span>{activity.actor_name} · {activity.actor_email} · rôle : {activity.actor_role}</span>
          <span>{activity.entity_type}{activity.pme_id ? ` · PME n° ${activity.pme_id}` : ''}{activity.purchase_id ? ` · achat n° ${activity.purchase_id}` : ''}</span>
        </div>
        <time dateTime={activity.created_at}>{new Date(activity.created_at).toLocaleString('fr-FR')}</time>
        {activity.details && Object.keys(activity.details).length > 0 && <details>
          <summary>Détails de l’opération</summary>
          <pre>{JSON.stringify(activity.details, null, 2)}</pre>
        </details>}
      </article>)}
    </div> : <p>Aucune activité ne correspond aux filtres.</p>}
    {!busy && rows.length === 500 && <p className="metric-note">Les 500 opérations les plus récentes correspondant aux filtres sont affichées. Affine la période pour consulter les anciennes entrées.</p>}
  </section>
}

const xmlEscape = value => String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/[<>&'"]/g, character => ({
  '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;',
})[character])

const excelColumn = index => {
  let name = ''
  for (let value = index + 1; value > 0; value = Math.floor((value - 1) / 26)) {
    name = String.fromCharCode(65 + (value - 1) % 26) + name
  }
  return name
}

const createXlsxBlob = sheets => {
  const encoder = new TextEncoder()
  const crcTable = new Uint32Array(256)
  for (let index = 0; index < 256; index += 1) {
    let value = index
    for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    crcTable[index] = value >>> 0
  }
  const crc32 = bytes => {
    let crc = 0xffffffff
    for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8)
    return (crc ^ 0xffffffff) >>> 0
  }
  const join = parts => {
    const result = new Uint8Array(parts.reduce((size, part) => size + part.length, 0))
    let offset = 0
    for (const part of parts) { result.set(part, offset); offset += part.length }
    return result
  }
  const worksheetXml = sheet => {
    const rows = [sheet.headers, ...sheet.rows]
    const rowXml = rows.map((row, rowIndex) => `<row r="${rowIndex + 1}">${row.map((value, columnIndex) => {
      const cell = `${excelColumn(columnIndex)}${rowIndex + 1}`
      if (rowIndex === 0) return `<c r="${cell}" s="1" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`
      if (typeof value === 'number' && Number.isFinite(value)) return `<c r="${cell}"><v>${value}</v></c>`
      return `<c r="${cell}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`
    }).join('')}</row>`).join('')
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetData>${rowXml}</sheetData></worksheet>`
  }
  const files = [
    { name: '[Content_Types].xml', text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>` },
    { name: '_rels/.rels', text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
    { name: 'xl/workbook.xml', text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((sheet, index) => `<sheet name="${xmlEscape(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join('')}</sheets></workbook>` },
    { name: 'xl/_rels/workbook.xml.rels', text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { name: 'xl/styles.xml', text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF183C63"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs></styleSheet>' },
    ...sheets.map((sheet, index) => ({ name: `xl/worksheets/sheet${index + 1}.xml`, text: worksheetXml(sheet) })),
  ]
  const localParts = []
  const centralParts = []
  let localOffset = 0
  for (const file of files) {
    const filename = encoder.encode(file.name)
    const content = encoder.encode(file.text)
    const checksum = crc32(content)
    const localHeader = new Uint8Array(30 + filename.length)
    const localView = new DataView(localHeader.buffer)
    localView.setUint32(0, 0x04034b50, true)
    localView.setUint16(4, 20, true); localView.setUint16(6, 0, true); localView.setUint16(8, 0, true)
    localView.setUint16(10, 0, true); localView.setUint16(12, 33, true)
    localView.setUint32(14, checksum, true); localView.setUint32(18, content.length, true); localView.setUint32(22, content.length, true)
    localView.setUint16(26, filename.length, true); localView.setUint16(28, 0, true)
    localHeader.set(filename, 30)
    localParts.push(localHeader, content)

    const centralHeader = new Uint8Array(46 + filename.length)
    const centralView = new DataView(centralHeader.buffer)
    centralView.setUint32(0, 0x02014b50, true)
    centralView.setUint16(4, 20, true); centralView.setUint16(6, 20, true); centralView.setUint16(8, 0, true)
    centralView.setUint16(10, 0, true); centralView.setUint16(12, 0, true); centralView.setUint16(14, 33, true)
    centralView.setUint32(16, checksum, true); centralView.setUint32(20, content.length, true); centralView.setUint32(24, content.length, true)
    centralView.setUint16(28, filename.length, true); centralView.setUint16(30, 0, true); centralView.setUint16(32, 0, true)
    centralView.setUint16(34, 0, true); centralView.setUint16(36, 0, true); centralView.setUint32(38, 0, true)
    centralView.setUint32(42, localOffset, true); centralHeader.set(filename, 46)
    centralParts.push(centralHeader)
    localOffset += localHeader.length + content.length
  }
  const centralDirectory = join(centralParts)
  const end = new Uint8Array(22)
  const endView = new DataView(end.buffer)
  endView.setUint32(0, 0x06054b50, true); endView.setUint16(4, 0, true); endView.setUint16(6, 0, true)
  endView.setUint16(8, files.length, true); endView.setUint16(10, files.length, true)
  endView.setUint32(12, centralDirectory.length, true); endView.setUint32(16, localOffset, true); endView.setUint16(20, 0, true)
  return new Blob([join(localParts), centralDirectory, end], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

const REPORT_LABELS = {
  pmes: 'Rapport des PME',
  purchases: 'Rapport des achats',
  authorizations: 'Rapport des autorisations',
  global: 'Rapport global des opérations',
}

function ReportCenter({ pmes, achats, documents }) {
  const [filters, setFilters] = useState({ type: 'global', from: '', to: '', company: '', admin: '', status: '' })
  const [activities, setActivities] = useState([])
  const [periodActivities, setPeriodActivities] = useState([])
  const [busy, setBusy] = useState(false)
  const [exportNotice, setExportNotice] = useState('')
  const setFilter = key => event => setFilters(current => ({ ...current, [key]: event.target.value }))
  const pmeById = useMemo(() => new Map(pmes.map(pme => [String(pme.id), pme])), [pmes])
  useEffect(() => {
    let active = true
    let from = null
    let to = null
    if (filters.from) from = new Date(`${filters.from}T00:00:00.000Z`).toISOString()
    if (filters.to) {
      const end = new Date(`${filters.to}T00:00:00.000Z`)
      end.setUTCDate(end.getUTCDate() + 1)
      to = end.toISOString()
    }
    setBusy(true)
    setActivities([])
    setPeriodActivities([])
    setExportNotice('')
    const latestRequest = supabase.rpc('report_activity', { p_from: null, p_to: null })
    const periodRequest = filters.from || filters.to
      ? supabase.rpc('report_activity', { p_from: from, p_to: to })
      : latestRequest
    Promise.all([latestRequest, periodRequest]).then(([latest, period]) => {
      if (!active) return
      if (latest.error) setExportNotice(`Chargement des administrateurs impossible : ${latest.error.message}`)
      else setActivities(latest.data || [])
      if (period.error) setExportNotice(`Chargement des activités de la période impossible : ${period.error.message}`)
      else setPeriodActivities(period.data || [])
      setBusy(false)
    }).catch(error => {
      if (!active) return
      setExportNotice(`Chargement des activités impossible : ${error instanceof Error ? error.message : String(error)}`)
      setBusy(false)
    })
    return () => { active = false }
  }, [filters.from, filters.to])
  const lookupActivities = useMemo(() => {
    const byId = new Map([...activities, ...periodActivities].map(activity => [activity.id, activity]))
    return [...byId.values()].sort((left, right) => new Date(right.created_at) - new Date(left.created_at))
  }, [activities, periodActivities])
  const actorFor = (operation, entityType, entityId) => lookupActivities.find(activity =>
    activity.operation === operation && activity.entity_type === entityType && activity.entity_id === String(entityId))
  const recentActorForPme = pmeId => lookupActivities.find(activity =>
    activity.operation === 'authorization.updated' && activity.pme_id === pmeId)
  const match = ({ pme, date, actor, statusCodes = [] }) => {
    const day = date ? String(date).slice(0, 10) : ''
    if (filters.from && (!day || day < filters.from)) return false
    if (filters.to && (!day || day > filters.to)) return false
    if (filters.company && String(pme?.id) !== filters.company) return false
    if (filters.admin && actor?.actor_email?.toLowerCase() !== filters.admin.toLowerCase()) return false
    if (filters.status && !statusCodes.includes(filters.status)) return false
    return true
  }
  const pmeRows = pmes.filter(pme => {
    const created = actorFor('pme.created', 'pme', pme.id)
    const date = pme.createdAt || created?.created_at
    return match({
      pme, date, actor: created,
      statusCodes: [pme.dossierStatus, pme.authorizationStatus],
    })
  }).map(pme => {
    const created = actorFor('pme.created', 'pme', pme.id)
    return [pme.id, pme.nom, pme.type || '', pme.createdAt ? new Date(pme.createdAt).toLocaleDateString('fr-FR') : created?.created_at ? new Date(created.created_at).toLocaleDateString('fr-FR') : '', DOSSIER_LABELS[pme.dossierStatus] || pme.dossierStatus, AUTH_LABELS[pme.authorizationStatus] || pme.authorizationStatus, created?.actor_email || 'Non renseigné']
  })
  const purchaseRows = achats.filter(achat => {
    const pme = pmeById.get(String(achat.pmeId))
    const created = actorFor('purchase.created', 'purchase', achat.id)
    return match({ pme, date: achat.date, actor: created, statusCodes: [pme?.dossierStatus, pme?.authorizationStatus] })
  }).map(achat => {
    const pme = pmeById.get(String(achat.pmeId))
    const created = actorFor('purchase.created', 'purchase', achat.id)
    return [achat.id, achat.date, pme?.nom || 'PME inconnue', achat.designation || '', Number(achat.qte), achat.unite || 'sacs', achat.prixUnitaire == null ? '' : Number(achat.prixUnitaire), achat.devise || '', achat.montantTotal == null ? '' : Number(achat.montantTotal), created?.actor_email || 'Non renseigné']
  })
  const authorizationRows = pmes.filter(pme => {
    const actor = recentActorForPme(pme.id)
    return match({
      pme, date: pme.authorizationIssueDate || actor?.created_at, actor,
      statusCodes: [pme.authorizationStatus],
    })
  }).map(pme => {
    const actor = recentActorForPme(pme.id)
    const fileNames = documents.filter(document => document.pmeId === pme.id && document.path).map(document => document.filename || document.name).join(', ')
    return [pme.id, pme.nom, pme.authorizationReference || pme.numAut || 'Autorisation REGEDEK', pme.authorizationIssueDate || '', pme.authorizationExpiryDate || '', AUTH_LABELS[pme.authorizationStatus] || pme.authorizationStatus, fileNames, actor?.actor_email || 'Non renseigné']
  })
  const activityRows = periodActivities.filter(activity => {
    const pme = pmeById.get(String(activity.pme_id || (activity.entity_type === 'pme' ? activity.entity_id : '')))
    return match({
      pme, date: activity.created_at, actor: activity,
      statusCodes: [pme?.dossierStatus, pme?.authorizationStatus, activity.operation],
    })
  }).map(activity => {
    const pme = pmeById.get(String(activity.pme_id || (activity.entity_type === 'pme' ? activity.entity_id : '')))
    return [new Date(activity.created_at).toLocaleString('fr-FR'), activity.actor_name, activity.actor_email, activity.actor_role, ACTIVITY_LABELS[activity.operation] || activity.operation, pme?.nom || '', activity.entity_type, activity.entity_id, Object.keys(activity.details || {}).length ? JSON.stringify(activity.details) : '']
  })
  const sheetsByType = {
    pmes: [{ name: 'PME', headers: ['ID PME', 'Entreprise', 'Catégorie', 'Date d’enregistrement', 'Statut du dossier', 'Statut d’autorisation', 'Administrateur'], rows: pmeRows }],
    purchases: [{ name: 'Achats', headers: ['ID achat', 'Date', 'Entreprise', 'Produit / service', 'Quantité', 'Unité', 'Prix unitaire', 'Devise', 'Montant total', 'Administrateur'], rows: purchaseRows }],
    authorizations: [{ name: 'Autorisations', headers: ['ID PME', 'Entreprise', 'Nature / référence', 'Date d’obtention', 'Date d’expiration', 'Statut', 'Documents associés', 'Administrateur'], rows: authorizationRows }],
    global: [
      { name: 'PME', headers: ['ID PME', 'Entreprise', 'Catégorie', 'Date d’enregistrement', 'Statut du dossier', 'Statut d’autorisation', 'Administrateur'], rows: pmeRows },
      { name: 'Achats', headers: ['ID achat', 'Date', 'Entreprise', 'Produit / service', 'Quantité', 'Unité', 'Prix unitaire', 'Devise', 'Montant total', 'Administrateur'], rows: purchaseRows },
      { name: 'Autorisations', headers: ['ID PME', 'Entreprise', 'Nature / référence', 'Date d’obtention', 'Date d’expiration', 'Statut', 'Documents associés', 'Administrateur'], rows: authorizationRows },
      { name: 'Activités', headers: ['Date et heure', 'Nom', 'E-mail', 'Rôle', 'Opération', 'Entreprise', 'Type d’entité', 'ID entité', 'Détails'], rows: activityRows },
    ],
  }
  const sheets = sheetsByType[filters.type]
  const generatedAt = new Date().toLocaleString('fr-FR')
  const filenameDate = new Date().toISOString().slice(0, 10)
  const downloadXlsx = () => {
    try {
      const blob = createXlsxBlob(sheets)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url; link.download = `rapport_regedek_${filters.type}_${filenameDate}.xlsx`; link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      setExportNotice('Le classeur Excel a été généré.')
    } catch (error) {
      setExportNotice(`Génération Excel impossible : ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  const downloadPdf = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      setExportNotice('Le rapport PDF n’a pas pu s’ouvrir. Autorise les fenêtres contextuelles pour ce site puis réessaie.')
      return
    }
    const sections = sheets.map(sheet => `<section><h2>${xmlEscape(sheet.name)}</h2><table><thead><tr>${sheet.headers.map(header => `<th>${xmlEscape(header)}</th>`).join('')}</tr></thead><tbody>${sheet.rows.map(row => `<tr>${row.map(value => `<td>${xmlEscape(value)}</td>`).join('')}</tr>`).join('')}</tbody></table>${sheet.rows.length ? '' : '<p>Aucune donnée pour cette catégorie.</p>'}</section>`).join('')
    printWindow.document.open()
    printWindow.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${xmlEscape(REPORT_LABELS[filters.type])}</title><style>@page{size:A4 landscape;margin:16mm 12mm 18mm;@bottom-right{content:"Page " counter(page) " / " counter(pages);font:10px Arial;color:#596a7d}}body{font-family:Arial,sans-serif;color:#1d2b3a}h1{color:#102a46;margin-bottom:4px}h2{color:#183c63;border-bottom:1px solid #dce5ee;padding-bottom:6px;margin-top:24px}.meta{color:#596a7d;font-size:12px;margin-bottom:20px}table{width:100%;border-collapse:collapse;font-size:9px}thead{display:table-header-group}tr{break-inside:avoid}th,td{border:1px solid #dce5ee;padding:6px;text-align:left;overflow-wrap:anywhere}th{background:#183c63;color:white}tbody tr:nth-child(even){background:#f2f6fb}footer{position:fixed;bottom:-10mm;left:0;color:#596a7d;font-size:9px}@media print{section{break-after:page}section:last-child{break-after:auto}}</style></head><body><h1>${xmlEscape(REPORT_LABELS[filters.type])}</h1><p class="meta">REGEDEK PME · Généré le ${xmlEscape(generatedAt)} · Données protégées</p>${sections}<footer>REGEDEK PME · Document interne</footer><script>window.onload=()=>window.print()</script></body></html>`)
    printWindow.document.close()
    setExportNotice('La fenêtre d’impression est ouverte. Choisis « Enregistrer au format PDF » pour télécharger le rapport.')
  }
  const allStatuses = [...DOSSIER_STATUSES.map(status => [status, DOSSIER_LABELS[status]]), ...AUTH_STATUSES.map(status => [status, AUTH_LABELS[status]])]
  const admins = [...new Set(lookupActivities.map(activity => activity.actor_email).filter(Boolean))].sort()
  return <section className="report-center">
    <h2>Rapports et téléchargements</h2>
    <p>Les montants des achats historiques restent vides tant qu’ils n’ont pas été saisis manuellement. Aucun montant n’est estimé à partir des quantités.</p>
    <div className="bar filters">
      <select aria-label="Catégorie de rapport" value={filters.type} onChange={setFilter('type')}>{Object.entries(REPORT_LABELS).map(([type, label]) => <option key={type} value={type}>{label}</option>)}</select>
      <label>Du <input type="date" value={filters.from} onChange={setFilter('from')} /></label>
      <label>Au <input type="date" value={filters.to} onChange={setFilter('to')} /></label>
      <select aria-label="Filtrer par entreprise" value={filters.company} onChange={setFilter('company')}><option value="">Toutes les entreprises</option>{pmes.map(pme => <option key={pme.id} value={pme.id}>{pme.nom}</option>)}</select>
      <select aria-label="Filtrer par administrateur" value={filters.admin} onChange={setFilter('admin')}><option value="">Tous les administrateurs</option>{admins.map(admin => <option key={admin} value={admin}>{admin}</option>)}</select>
      <select aria-label="Filtrer par statut" value={filters.status} onChange={setFilter('status')}><option value="">Tous les statuts</option>{allStatuses.map(([status, label]) => <option key={status} value={status}>{label}</option>)}</select>
    </div>
    {busy ? <p>Chargement des activités et des administrateurs…</p> : <>
      <div className="report-summary">{sheets.map(sheet => <div key={sheet.name}><strong>{sheet.rows.length.toLocaleString('fr-FR')}</strong><span>{sheet.name}</span></div>)}</div>
      <div className="row"><button className="btn" onClick={downloadPdf}>Télécharger PDF</button><button className="btn sec" onClick={downloadXlsx}>Télécharger Excel (.xlsx)</button></div>
      {exportNotice && <p role="status" className="notice">{exportNotice}</p>}
      {(activities.length >= 10000 || periodActivities.length >= 10000) && <p className="metric-note">Le journal est limité aux 10 000 opérations les plus récentes, ou aux 10 000 opérations de la période sélectionnée. Affine les dates si nécessaire.</p>}
    </>}
  </section>
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
  const [f, setF] = useState({
    ...a, designation: a.designation || '', unite: a.unite || 'sacs',
    prixUnitaire: a.prixUnitaire == null ? '' : String(a.prixUnitaire),
    devise: a.devise || 'CDF',
  })
  const set = key => event => setF(current => ({ ...current, [key]: event.target.value }))
  const submit = () => {
    const hasPriceData = Boolean(f.designation.trim() || f.prixUnitaire !== '')
    if (!f.pmeId || !f.date || !Number.isInteger(Number(f.qte)) || Number(f.qte) <= 0 || !f.unite.trim()) {
      alert('PME, date, unité et quantité entière positive obligatoires.')
      return
    }
    if ((!f.id || hasPriceData) && (!f.designation.trim() || f.prixUnitaire === '' || !Number.isFinite(Number(f.prixUnitaire)) || Number(f.prixUnitaire) < 0 || !f.devise)) {
      alert('Pour enregistrer un nouvel achat ou compléter ses montants, renseigne la désignation, le prix unitaire et la devise.')
      return
    }
    onSave(f)
  }
  return <div className="modal"><div className="box">
    <h2>{f.id ? 'Modifier l’achat' : 'Enregistrer un achat'}</h2>
    <div className="grid">
      <div className="full"><label>PME</label><select value={f.pmeId} onChange={e => setF({ ...f, pmeId: +e.target.value })}>{[...pmes].sort((a, b) => a.id - b.id).map((p, index) => <option key={p.id} value={p.id}>{index + 1} — {p.nom}</option>)}</select></div>
      <div><label>Date d’achat</label><input type="date" value={f.date} onChange={set('date')} required /></div>
      <div><label>Désignation du produit ou service</label><input value={f.designation} onChange={set('designation')} placeholder="Ex. Sacs-poubelle" required={!f.id} /></div>
      <div><label>Quantité</label><input type="number" min="1" step="1" value={f.qte} onChange={set('qte')} required /></div>
      <div><label>Unité</label><input value={f.unite} onChange={set('unite')} required /></div>
      <div><label>Prix unitaire</label><input type="number" min="0" step="0.01" value={f.prixUnitaire} onChange={set('prixUnitaire')} required={!f.id} /></div>
      <div><label>Devise</label><select value={f.devise} onChange={set('devise')} required={!f.id || f.prixUnitaire !== ''}><option value="CDF">CDF</option><option value="USD">USD</option></select></div>
      {f.prixUnitaire !== '' && Number.isFinite(Number(f.prixUnitaire)) && <p className="full metric-note">Montant total calculé : {(Number(f.qte) * Number(f.prixUnitaire)).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {f.devise}</p>}
      {f.id && f.prixUnitaire === '' && <p className="full metric-note">Aucun montant n’est enregistré pour cet achat historique. Tu peux le renseigner maintenant; aucune valeur ne sera estimée.</p>}
    </div>
    <div className="row"><button className="btn sec" onClick={onClose}>Annuler</button>
      <button className="btn" onClick={submit}>Enregistrer</button></div>
  </div></div>
}

function MoratoriumForm({ pmes, today, busy, onSave, onClose }) {
  const [form, setForm] = useState({
    pmeId: pmes[0]?.id || '',
    startsOn: today,
    expiresOn: today,
    reason: '',
    observations: '',
    file: null,
  })
  const [error, setError] = useState('')
  const set = key => event => setForm(current => ({ ...current, [key]: event.target.value }))
  const durationDays = form.startsOn && form.expiresOn
    ? Math.floor((Date.parse(`${form.expiresOn}T00:00:00Z`) - Date.parse(`${form.startsOn}T00:00:00Z`)) / 86400000) + 1
    : 0
  const submit = () => {
    if (!form.pmeId || !form.startsOn || !form.expiresOn || durationDays < 1 || !form.reason.trim()) {
      setError('Choisis la PME, des dates cohérentes et renseigne le motif du moratoire.')
      return
    }
    if (form.file && (form.file.size > 10 * 1024 * 1024 || !['application/pdf', 'image/jpeg', 'image/png'].includes(form.file.type))) {
      setError('Le justificatif doit être un PDF, une image JPG ou PNG de 10 Mo maximum.')
      return
    }
    setError('')
    onSave(form)
  }
  return <div className="modal" onClick={() => { if (!busy) onClose() }}><section className="box moratorium-form" onClick={event => event.stopPropagation()}>
    <h2>Attribuer un moratoire</h2>
    <p>Cette attribution sera conservée dans l’historique et ne pourra pas être modifiée ou supprimée depuis l’application.</p>
    {error && <p role="alert" className="notice">{error}</p>}
    <div className="grid">
      <div className="full"><label htmlFor="moratorium-pme">PME concernée</label><select id="moratorium-pme" value={form.pmeId} onChange={set('pmeId')} required>
        {pmes.map(pme => <option key={pme.id} value={pme.id}>{pme.nom}</option>)}
      </select></div>
      <div><label htmlFor="moratorium-start">Date de début</label><input id="moratorium-start" type="date" value={form.startsOn} onChange={set('startsOn')} required /></div>
      <div><label htmlFor="moratorium-expiry">Date de fin</label><input id="moratorium-expiry" type="date" min={form.startsOn} value={form.expiresOn} onChange={set('expiresOn')} required /></div>
      <p className="full moratorium-duration">Durée calculée : <strong>{durationDays > 0 ? `${durationDays} jour${durationDays > 1 ? 's' : ''}` : 'dates à vérifier'}</strong></p>
      <div className="full"><label htmlFor="moratorium-reason">Motif de l’attribution</label><textarea id="moratorium-reason" value={form.reason} onChange={set('reason')} required /></div>
      <div className="full"><label htmlFor="moratorium-observations">Observations complémentaires</label><textarea id="moratorium-observations" value={form.observations} onChange={set('observations')} /></div>
      <div className="full"><label htmlFor="moratorium-file">Pièce justificative (facultative, PDF/JPG/PNG — 10 Mo max.)</label><input id="moratorium-file" type="file" accept="application/pdf,image/jpeg,image/png" onChange={event => setForm(current => ({ ...current, file: event.target.files?.[0] || null }))} /></div>
      <p className="full metric-note">L’administrateur qui accorde le moratoire est enregistré automatiquement à partir de la session authentifiée.</p>
    </div>
    <div className="row"><button className="btn sec" disabled={busy} onClick={onClose}>Annuler</button><button className="btn" disabled={busy || !pmes.length} onClick={submit}>{busy ? 'Enregistrement…' : 'Enregistrer le moratoire'}</button></div>
  </section></div>
}

function MoratoriumHistory({ pme, rows, today, onOpenAttachment, onClose }) {
  return <div className="modal" onClick={onClose}><section className="box moratorium-history" onClick={event => event.stopPropagation()}>
    <div className="row"><h2>Historique des moratoires — {pme.nom}</h2><button className="btn sec" onClick={onClose}>Fermer</button></div>
    {rows.length ? rows.map(moratorium => {
      const status = getMoratoriumStatus(moratorium, today)
      return <article className="moratorium-history-item" key={moratorium.id}>
        <div className="row"><strong>{fmt(moratorium.startsOn)} — {fmt(moratorium.expiresOn)} · {moratorium.durationDays} jour(s)</strong><Tag s={{ label: MORATORIUM_STATUS_LABELS[status.code], cls: MORATORIUM_STATUS_COLORS[status.code] }} /></div>
        <p><strong>Motif :</strong> {moratorium.reason}</p>
        <p><strong>Observations :</strong> {moratorium.observations || '—'}</p>
        <p><strong>Accordé par :</strong> {moratorium.grantedByName}{moratorium.grantedByEmail ? ` · ${moratorium.grantedByEmail}` : ''} · <strong>Enregistré le :</strong> {new Date(moratorium.createdAt).toLocaleString('fr-FR')}</p>
        {moratorium.attachmentPath && <button className="btn sec" onClick={() => onOpenAttachment(moratorium)}>Ouvrir {moratorium.attachmentName || 'le justificatif'}</button>}
      </article>
    }) : <p>Aucun moratoire enregistré pour cette PME.</p>}
  </section></div>
}
