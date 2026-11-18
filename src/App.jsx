import { useState, useEffect, useMemo } from 'react'
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
const dossierTag = status => ({ label: DOSSIER_LABELS[status] || 'Dossier non soumis', cls: DOSSIER_COLORS[status] || 'gris' })
const todayKinshasa = () => {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'Africa/Kinshasa', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const part = type => parts.find(item => item.type === type)?.value || ''
  return `${part('year')}-${part('month')}-${part('day')}`
}
const authTag = (status, expiry) => status === 'AUTORISE' && expiry && expiry < todayKinshasa()
  ? { label: 'Expiré', cls: 'rouge' }
  : ({ label: AUTH_LABELS[status] || AUTH_LABELS.EN_ETUDE_ADMINISTRATIVE, cls: AUTH_COLORS[status] || 'bleu' })
const VIDE = { nom: '', type: 'MENAGE', numAut: '', dateAut: '', expAut: '', dateAgr: '', expAgr: '', contact: '', tel: '', email: '', adresse: '', communes: '', quartiers: '', statutJuridique: '', source: 'saisie manuelle', note: '', dossierStatus: 'DOSSIER_NON_SOUMIS', dossierObservations: '', authorizationStatus: 'EN_ETUDE_ADMINISTRATIVE', authorizationReference: '', authorizationIssueDate: '', authorizationExpiryDate: '', authorizationObservations: '', nonComplianceReason: '', authorizationChangeReason: '', authoritySignerName: '', authoritySignerTitle: '' }

const toPme = (p) => ({
  id: p.id, nom: p.nom, type: p.type, numAut: p.num_aut, dateAut: p.date_aut || '', expAut: p.exp_aut || '',
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
  const [accessError, setAccessError] = useState('')
  const [bootstrapAvailable, setBootstrapAvailable] = useState(null)
  const [authBusy, setAuthBusy] = useState(false)
  const [authNotice, setAuthNotice] = useState('')
  const [passwordRecovery, setPasswordRecovery] = useState(false)
  const [pmes, setPmes] = useState([])
  const [archivedPmes, setArchivedPmes] = useState([])
  const [achats, setAchats] = useState([])
  const [documents, setDocuments] = useState([])
  const [inspections, setInspections] = useState([])
  const [dossierHistory, setDossierHistory] = useState([])
  const [authorizationHistory, setAuthorizationHistory] = useState([])
  const [verificationResult, setVerificationResult] = useState(undefined)
  const [certificate, setCertificate] = useState(null)
  const [cfg, setCfg] = useState({ alerte: 30, inactif: 90 })
  const [notice, setNotice] = useState('')
  const [tab, setTab] = useState('dash')
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
    setDataReady(false); setRole(null); setAccessError(''); setNotice('')
    const load = async () => {
      if (!session) {
        setPmes([]); setArchivedPmes([]); setAchats([]); setDataReady(true)
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
        setRole(null); setPmes([]); setAchats([]); setDataReady(true)
        return
      }
      const [pmeRows, achatRows, settingsResult, documentRows, dossierRows, authorizationRows, inspectionRows] = await Promise.all([
        fetchAll('pmes', 'id'),
        fetchAll('achats', 'date', false),
        supabase.from('settings').select('alerte, inactif').eq('id', true).single(),
        fetchAll('pme_documents', 'created_at', false),
        fetchAll('pme_dossier_history', 'created_at', false),
        fetchAll('pme_authorization_history', 'created_at', false),
        fetchAll('pme_inspection_reports', 'inspection_date', false),
      ])
      if (settingsResult.error) throw settingsResult.error
      if (cancelled) return
      const allPmes = pmeRows.map(toPme)
      setRole(nextRole); setPmes(allPmes.filter(p => !p.archivedAt)); setArchivedPmes(allPmes.filter(p => p.archivedAt)); setAchats(achatRows.map(toAchat)); setDocuments(documentRows.map(toDocument)); setInspections(inspectionRows.map(toInspection)); setDossierHistory(dossierRows.map(toHistory)); setAuthorizationHistory(authorizationRows.map(toHistory)); setCfg(settingsResult.data); setDataReady(true)
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

  const canEdit = role === 'admin' || role === 'agent'
  const isAdmin = role === 'admin'
  const reportError = (error) => setNotice(`Opération impossible : ${error.message}`)

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
  const statutsDates = ['Valide', 'Expiré', 'À renouveler', 'Non renseigné', 'À vérifier']
  const totalStatutsAut = statutsDates.reduce((total, statut) => total + count(r => r.sAut.label === statut), 0)
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
  const saveDocument = async (document, file) => {
    const pmeId = detail?.id
    if (!pmeId || !document.name.trim()) return
    let path = document.path || null
    if (file) {
      if (file.size > 10 * 1024 * 1024) { setNotice('Le fichier dépasse la limite de 10 Mo.'); return }
      const safeName = file.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_')
      path = `${pmeId}/${crypto.randomUUID()}-${safeName}`
      const { error: uploadError } = await supabase.storage.from('pme-documents').upload(path, file, { contentType: file.type, upsert: false })
      if (uploadError) { reportError(uploadError); return }
    }
    const payload = { pme_id: pmeId, document_name: document.name.trim(), is_required: document.required, status: path ? 'EN_ATTENTE_DE_VERIFICATION' : 'MANQUANT', storage_path: path, original_filename: file?.name || document.filename || '', mime_type: file?.type || document.mime || '', file_size: file?.size ?? document.size ?? null, observations: document.observations || '', rejection_reason: '' }
    const { data, error } = document.id
      ? await supabase.from('pme_documents').update(payload).eq('id', document.id).select().single()
      : await supabase.from('pme_documents').insert({ ...payload, created_by: session.user.id }).select().single()
    if (error) { if (file && path) await supabase.storage.from('pme-documents').remove([path]); reportError(error); return }
    setDocuments(current => document.id ? current.map(d => d.id === document.id ? toDocument(data) : d) : [toDocument(data), ...current])
    const history = await fetchAll('pme_dossier_history', 'created_at', false); setDossierHistory(history.map(toHistory)); setNotice('Document enregistré.');
  }
  const deleteDocument = async doc => {
    if (doc.path) { const { error } = await supabase.storage.from('pme-documents').remove([doc.path]); if (error) { reportError(error); return } }
    const { error } = await supabase.from('pme_documents').delete().eq('id', doc.id)
    if (error) { reportError(error); return }
    setDocuments(current => current.filter(d => d.id !== doc.id))
    const history = await fetchAll('pme_dossier_history', 'created_at', false); setDossierHistory(history.map(toHistory))
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
  const openDocument = async doc => {
    const { data, error } = await supabase.storage.from('pme-documents').createSignedUrl(doc.path, 60)
    if (error) { reportError(error); return }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
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
    if (!isAdmin || !confirm(archived
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

  return (<>
    <header>
      <Brand compact />
      <nav>
        {[['dash', 'Tableau de bord'], ['pme', 'PME AUTORISÉES'], ...(isAdmin ? [['archived', 'PME archivées']] : []), ['achats', 'Achats'], ['cfg', 'Réglages']].map(([k, l]) =>
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => { setTab(k); if (k !== 'pme') { setFStatAut(''); setFStatMin('') } }}>{l}</button>)}
      </nav>
      {session && <button className="btn sec sign-out" onClick={signOut}>Se déconnecter</button>}
    </header>
    <main>
      {notice && <p role="alert" className="notice">{notice}</p>}
      {tab === 'dash' && <>
        <h2>Suivi administratif des dossiers PME</h2>
        <div className="cards">
          <div className="card" onClick={() => goDossier('')}><b>{rows.length}</b><span>PME suivies</span></div>
          {DOSSIER_STATUSES.map(status => <div className="card" key={status} onClick={() => goDossier(status)}><b>{count(r => r.dossierStatus === status)}</b><span>{DOSSIER_LABELS[status]}</span></div>)}
        </div>
        <p className="metric-note">Répartition des dossiers : {DOSSIER_STATUSES.reduce((sum, status) => sum + count(r => r.dossierStatus === status), 0)} / {rows.length}. La complétude du dossier n’accorde jamais automatiquement une autorisation REGEDEK.</p>
        <h2>Documents administratifs</h2>
        <div className="cards">
          <div className="card" onClick={showIncomplete}><b>{documents.filter(d => d.required).length}</b><span>Documents demandés</span></div>
          <div className="card" onClick={showIncomplete}><b>{documents.filter(d => Boolean(d.path)).length}</b><span>Documents reçus</span></div>
          <div className="card" onClick={showIncomplete}><b>{documents.filter(d => d.status === 'VALIDE').length}</b><span>Documents validés</span></div>
          <div className="card" onClick={showIncomplete}><b>{documents.filter(d => d.required && ['MANQUANT', 'REJETE'].includes(d.status)).length}</b><span>Documents manquants ou rejetés</span></div>
          <div className="card" onClick={showIncomplete}><b>{documents.filter(d => d.status === 'EN_ATTENTE_DE_VERIFICATION').length}</b><span>Documents en attente de vérification</span></div>
        </div>
        <h2>Situation réglementaire REGEDEK</h2>
        <div className="cards">
          {AUTH_STATUSES.map(status => <div className="card" key={status} onClick={() => goAuthorization(status)}><b>{count(r => authTag(r.authorizationStatus, r.authorizationExpiryDate).label === AUTH_LABELS[status])}</b><span>{AUTH_LABELS[status]}</span></div>)}
        </div>
        <p className="metric-note">Répartition réglementaire : {AUTH_STATUSES.reduce((sum, status) => sum + count(r => authTag(r.authorizationStatus, r.authorizationExpiryDate).label === AUTH_LABELS[status]), 0)} / {rows.length}. L’autorisation est attribuée uniquement après décision enregistrée par un administrateur habilité.</p>
        <h2>Anciennes échéances REGEDEK et agréments ministériels</h2>
        <div className="cards">
          <div className="card" onClick={() => go('')}><b>{rows.length}</b><span>Dossiers PME suivis</span></div>
          <div className="card" onClick={() => go('Valide')}><b>{count(r => r.sAut.label === 'Valide')}</b><span>Autorisations en cours</span></div>
          <div className="card" onClick={() => go('Expiré')}><b>{count(r => r.sAut.label === 'Expiré')}</b><span>Autorisations expirées</span></div>
          <div className="card" onClick={() => go('À renouveler')}><b>{count(r => r.sAut.label === 'À renouveler')}</b><span>Autorisations à renouveler</span></div>
          <div className="card" onClick={() => go('Non renseigné')}><b>{count(r => r.sAut.label === 'Non renseigné')}</b><span>Dates d'expiration non renseignées</span></div>
          <div className="card" onClick={() => go('À vérifier')}><b>{count(r => r.sAut.label === 'À vérifier')}</b><span>Dates REGEDEK à vérifier</span></div>
        </div>
        <p className="metric-note">Répartition REGEDEK : {totalStatutsAut} / {rows.length} dossiers. Parmi les dossiers sans échéance, {horsRegistre} proviennent uniquement d'achats ou d'enquêtes et {registreSansEcheance} sont de source registre sans date d'expiration.</p>
        <h2>Agréments ministériels</h2>
        <div className="cards">
          <div className="card" onClick={() => go('Valide', 'fStatMin')}><b>{count(r => r.sAgr.label === 'Valide')}</b><span>Agréments valides</span></div>
          <div className="card" onClick={() => go('Expiré', 'fStatMin')}><b>{count(r => r.sAgr.label === 'Expiré')}</b><span>Agréments expirés</span></div>
          <div className="card" onClick={() => go('À renouveler', 'fStatMin')}><b>{count(r => r.sAgr.label === 'À renouveler')}</b><span>Agréments à renouveler</span></div>
          <div className="card" onClick={() => go('Non renseigné', 'fStatMin')}><b>{count(r => r.sAgr.label === 'Non renseigné')}</b><span>Dates d'agrément non renseignées</span></div>
          <div className="card" onClick={() => go('À vérifier', 'fStatMin')}><b>{count(r => r.sAgr.label === 'À vérifier')}</b><span>Dates d'agrément à vérifier</span></div>
        </div>
        <h2>Qualité des dossiers</h2>
        <div className="cards">
          <div className="card" onClick={showIncomplete}><b>{count(r => r.isIncomplete || r.sAut.label === 'À vérifier' || r.sAgr.label === 'À vérifier')}</b><span>Dossiers incomplets ou dates à vérifier</span></div>
        </div>
        <h2>À surveiller</h2>
        <Table rows={rows.filter(r => r.authorizationStatus !== 'AUTORISE' || r.dossierStatus !== 'VALIDE_ADMINISTRATIVEMENT' || documentStats(r.id).missing > 0 || r.sAut.label !== 'Valide' || r.sAgr.label !== 'Valide' || r.isIncomplete || r.sAct.label !== 'Active')} onOpen={setDetail} canEdit={canEdit} isAdmin={isAdmin} />
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
          {canEdit && <button className="btn" onClick={() => setEdit({ ...VIDE })}>+ Nouvelle PME</button>}
          <button className="btn sec" onClick={exportCsv}>Exporter CSV</button>
        </div>
        <Table
          rows={filtered}
          onOpen={setDetail}
          onEdit={pme => setEdit(pme)}
          onArchive={pme => setPmeArchived(pme, true)}
          canEdit={canEdit}
          isAdmin={isAdmin}
        />
      </>}

      {tab === 'archived' && isAdmin && <ArchivedPmeTable rows={archivedPmes} onRestore={pme => setPmeArchived(pme, false)} />}

      {tab === 'achats' && <>
        <div className="bar">{canEdit && <button className="btn" onClick={() => setAchatFor({ pmeId: pmes[0]?.id, date: new Date().toISOString().slice(0, 10), qte: '' })}>+ Enregistrer un achat</button>}</div>
        <div className="tw"><table><thead><tr><th>Date</th><th>PME</th><th>Quantité</th><th></th></tr></thead><tbody>
          {[...achats].sort((a, b) => b.date.localeCompare(a.date)).map(a => <tr key={a.id}>
            <td>{fmt(a.date)}</td><td>{rows.find(p => p.id === a.pmeId)?.numero ?? '—'} — {[...pmes, ...archivedPmes].find(p => p.id === a.pmeId)?.nom || '?'}</td><td>{Number(a.qte).toLocaleString('fr')}</td>
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
      {detail && (() => { const r = rows.find(x => x.id === detail.id); if (!r) return null; const pmeDocs = documents.filter(d => d.pmeId === r.id); const pmeInspections = inspections.filter(x => x.pmeId === r.id); const dossierEvents = dossierHistory.filter(h => h.pme_id === r.id); const authorizationEvents = authorizationHistory.filter(h => h.pme_id === r.id); const docStats = documentStats(r.id); return (
      <div className="modal" onClick={() => setDetail(null)}><div className="box detail" onClick={e => e.stopPropagation()}>
        <h2>PME n° {r.numero} — {r.nom} <small>({r.type || '—'})</small></h2>
        <div className="status-summary"><div><span>STATUT DU DOSSIER PME</span><Tag s={dossierTag(r.dossierStatus)} /></div><div><span>STATUT D'AUTORISATION REGEDEK</span><Tag s={authTag(r.authorizationStatus, r.authorizationExpiryDate)} /></div></div>
        <p><strong>Contact :</strong> {r.contact || '—'} · <strong>Tél :</strong> {r.tel || '—'} · <strong>E-mail :</strong> {r.email || '—'}<br />
          <strong>Adresse :</strong> {r.adresse || '—'}<br />
          <strong>Communes :</strong> {r.communes.join(', ') || '—'}<br />
          <strong>Quartiers :</strong> {r.quartiers || '—'}<br />
          <strong>Statut juridique :</strong> {r.statutJuridique || '—'} · <strong>Source :</strong> {r.source || '—'}{r.note && <><br /><b>⚠ {r.note}</b></>}</p>
        <h2 className="subhead">Situation réglementaire et autorisation REGEDEK</h2>
        <div className={`decision-banner decision-${r.authorizationStatus?.toLowerCase()}`}><strong>{r.authorizationStatus === 'AUTORISE' && r.authorizationExpiryDate >= todayKinshasa() ? 'CETTE ENTREPRISE EST OFFICIELLEMENT AUTORISÉE PAR LA REGEDEK' : r.authorizationStatus === 'EXPIRE' || (r.authorizationStatus === 'AUTORISE' && r.authorizationExpiryDate < todayKinshasa()) ? "L'AUTORISATION DE CETTE ENTREPRISE EST EXPIRÉE" : r.authorizationStatus === 'NON_CONFORME' ? 'CETTE ENTREPRISE EST DÉCLARÉE NON CONFORME' : AUTH_LABELS[r.authorizationStatus]}</strong></div>
        <p><strong>Référence :</strong> {r.authorizationReference || '—'} · <strong>Délivrée le :</strong> {fmt(r.authorizationIssueDate)} · <strong>Expire le :</strong> {fmt(r.authorizationExpiryDate)}<br />
          <strong>Agent responsable :</strong> {r.authorizationAgentId || 'Non renseigné'} · <strong>Dernière mise à jour :</strong> {r.authorizationUpdatedAt ? new Date(r.authorizationUpdatedAt).toLocaleString('fr-FR') : '—'}<br />
          <strong>Signataire :</strong> {r.authoritySignerName || '—'} · {r.authoritySignerTitle || '—'}<br />
          <strong>Observations :</strong> {r.authorizationObservations || '—'}{r.nonComplianceReason && <><br /><strong>Motif de non-conformité :</strong> {r.nonComplianceReason}</>}
        </p>
        {r.authorizationStatus === 'AUTORISE' && <button className="btn certificate-button" disabled={authTag(r.authorizationStatus, r.authorizationExpiryDate).label !== 'Autorisé' || !r.authorizationReference || !r.authorizationIssueDate || !r.authoritySignerName || !r.authoritySignerTitle} onClick={() => openCertificate(r)}>Attestation d'autorisation · imprimer / PDF</button>}
        {isAdmin && <AuthorizationEditor pme={r} onSave={patch => saveAuthorization(r.id, patch)} />}
        <h2 className="subhead">Suivi administratif du dossier</h2>
        <p>{docStats.asked} documents demandés · {docStats.received} reçus · {docStats.approved} validés · {docStats.pending} en attente de vérification · {docStats.missing} manquants ou rejetés<br />
          <strong>Observations :</strong> {r.dossierObservations || '—'} · <strong>Mis à jour :</strong> {r.dossierUpdatedAt ? new Date(r.dossierUpdatedAt).toLocaleString('fr-FR') : '—'} · <strong>Agent :</strong> {r.dossierUpdatedBy || '—'}</p>
        {canEdit && <DossierEditor pme={r} onSave={patch => saveDossier(r.id, patch)} />}
        <DocumentManager documents={pmeDocs} canEdit={canEdit} isAdmin={isAdmin} onSave={saveDocument} onReview={reviewDocument} onOpen={openDocument} onDelete={deleteDocument} onUpdate={updateDocumentObservations} />
        <h2 className="subhead">Historique du dossier et des documents</h2>
        {dossierEvents.length ? <ul className="history-list">{dossierEvents.map(h => <li key={h.id}><strong>{h.event_type}</strong> · {h.old_status || '—'} → {h.new_status || '—'} · {new Date(h.created_at).toLocaleString('fr-FR')} · utilisateur {h.actor_id || 'système'}{h.observations ? ` · ${h.observations}` : ''}</li>)}</ul> : <p>Aucun événement documentaire enregistré.</p>}
        <h2 className="subhead">Historique des décisions d'autorisation</h2>
        {authorizationEvents.length ? <ul className="history-list">{authorizationEvents.map(h => <li key={h.id}><strong>{AUTH_LABELS[h.old_status] || '—'} → {AUTH_LABELS[h.new_status] || h.new_status}</strong> · {new Date(h.created_at).toLocaleString('fr-FR')} · utilisateur {h.actor_id || 'système'} · {h.reason || '—'} · référence {h.authorization_reference || '—'}</li>)}</ul> : <p>Aucune décision enregistrée.</p>}
        <h2 className="subhead">Rapports d'inspection</h2>
        {r.authorizationStatus === 'EN_ATTENTE_INSPECTION' && canEdit && <InspectionForm onSave={report => saveInspection(r.id, report)} />}
        {pmeInspections.length ? <ul className="history-list">{pmeInspections.map(report => <li key={report.id}><strong>{({ CONFORME: 'Conforme', NON_CONFORME: 'Non conforme', REINSPECTION_REQUISE: 'Nouvelle inspection requise' })[report.result]}</strong> · {fmt(report.date)} · agent {report.inspectorId || '—'} · {report.observations}</li>)}</ul> : <p>Aucun rapport d'inspection enregistré.</p>}
        <p><strong>Autorisation historique :</strong> {r.numAut || '—'} · {fmt(r.dateAut)} → {fmt(r.expAut)} <Tag s={r.sAut} /><br />
          <strong>Agrément ministère :</strong> {fmt(r.dateAgr)} → {fmt(r.expAgr)} <Tag s={r.sAgr} /><br />
          <strong>Transaction :</strong> {r.transaction} · <strong>Historique :</strong> {r.nbAutorisations || 1} enregistrement(s)<br />
          <strong>Activité :</strong> <Tag s={r.sAct} /> {r.sAct.jours !== null && `(dernier achat il y a ${r.sAct.jours} j)`}
        </p>
        <h2 className="subhead">Achats ({r.totalSacs.toLocaleString('fr')} sacs)</h2>
        {r.mine.length ? <ul>{r.mine.map(a => <li key={a.id}>{fmt(a.date)} : {Number(a.qte).toLocaleString('fr')} sacs</li>)}</ul> : <p>Aucun achat.</p>}
        <div className="row">
          {isAdmin && <button className="btn red" onClick={() => setPmeArchived(r, true)}>Archiver la PME</button>}
          {canEdit && <button className="btn sec" onClick={() => { setDetail(null); setAchatFor({ pmeId: r.id, date: new Date().toISOString().slice(0, 10), qte: '' }) }}>+ Achat</button>}
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

function Table({ rows, onOpen, onEdit, onArchive, canEdit, isAdmin }) {
  return <div className="tw"><table className="pme-table"><thead><tr>
    <th>N° PME</th><th>Entreprise</th><th>Catégorie</th><th>Statut du dossier</th><th>Autorisation REGEDEK</th><th>Décision réglementaire</th><th>Échéance REGEDEK historique</th><th>Statut ministériel</th><th>Expiration ministérielle</th><th>Téléphone</th><th>Actions</th>
  </tr></thead><tbody>
    {rows.map(r => <tr key={r.id} className="cl" onClick={() => onOpen(r)}>
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
          {isAdmin && <button className="btn red" onClick={(e) => { e.stopPropagation(); onArchive(r) }}>Archiver</button>}
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
    <h3>Modifier le statut d'autorisation · réservé à l'administrateur habilité</h3>
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

function DocumentManager({ documents, canEdit, isAdmin, onSave, onReview, onOpen, onDelete, onUpdate }) {
  const [name, setName] = useState('')
  const [required, setRequired] = useState(true)
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const add = async e => { e.preventDefault(); if (!file) return alert('Choisis le document à téléverser.'); setBusy(true); await onSave({ name, required }, file); setName(''); setFile(null); e.currentTarget?.reset?.(); setBusy(false) }
  const review = async (doc, status) => {
    const reason = status === 'REJETE' ? prompt('Motif obligatoire du rejet :') : ''
    if (status === 'REJETE' && !reason?.trim()) return
    await onReview(doc, status, reason?.trim() || '')
  }
  return <section className="documents-section">
    <h2 className="subhead">Documents demandés et transmis ({documents.length})</h2>
    {canEdit && <form className="document-upload" onSubmit={add}>
      <label>Nom du document demandé<input value={name} onChange={e => setName(e.target.value)} required /></label>
      <label className="check"><input type="checkbox" checked={required} onChange={e => setRequired(e.target.checked)} /> Document obligatoire</label>
    <label>Fichier transmis (facultatif · PDF, Word ou image · 10 Mo maximum)<input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp" onChange={e => setFile(e.target.files?.[0] || null)} /></label>
      <button className="btn" disabled={busy || !name.trim()}>{busy ? 'Enregistrement…' : file ? 'Ajouter et téléverser' : 'Ajouter le document demandé'}</button>
    </form>}
    {documents.length ? <div className="document-list">{documents.map(doc => <article className="document-item" key={doc.id}>
      <div><strong>{doc.name}</strong><span>{doc.required ? 'Obligatoire' : 'Facultatif'} · {doc.filename || 'Fichier non reçu'} · <Tag s={{ label: ({ MANQUANT: 'Manquant', EN_ATTENTE_DE_VERIFICATION: 'À vérifier', VALIDE: 'Validé', REJETE: 'Rejeté' })[doc.status] || doc.status, cls: ({ MANQUANT: 'rouge', EN_ATTENTE_DE_VERIFICATION: 'À vérifier', VALIDE: 'vert', REJETE: 'rouge' })[doc.status] || 'gris' }} /></span>
        {doc.observations && <small>Observation : {doc.observations}</small>}{doc.rejectionReason && <small>Motif du rejet : {doc.rejectionReason}</small>}</div>
      <div className="document-actions">{canEdit && !doc.path && <label className="upload-small">Transmettre le document<input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp" onChange={e => e.target.files?.[0] && onSave(doc, e.target.files[0])} /></label>}{doc.path && <button className="btn sec" onClick={() => onOpen(doc)}>Consulter / télécharger</button>}{canEdit && doc.path && doc.status !== 'VALIDE' && <button className="btn" onClick={() => review(doc, 'VALIDE')}>Valider</button>}{canEdit && doc.path && doc.status !== 'REJETE' && <button className="btn red" onClick={() => review(doc, 'REJETE')}>Rejeter</button>}{canEdit && <button className="btn sec" onClick={() => { const observations = prompt('Observations du gestionnaire :', doc.observations || ''); if (observations !== null) onUpdate(doc, observations) }}>Observation</button>}{isAdmin && <button className="btn sec" onClick={() => confirm('Supprimer ce document ?') && onDelete(doc)}>Supprimer</button>}</div>
    </article>)}</div> : <p>Aucun document demandé ou transmis.</p>}
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
  const [f, setF] = useState(a)
  return <div className="modal"><div className="box">
    <h2>Enregistrer un achat de sacs</h2>
    <div className="grid">
      <div className="full"><label>PME</label><select value={f.pmeId} onChange={e => setF({ ...f, pmeId: +e.target.value })}>{[...pmes].sort((a, b) => a.id - b.id).map((p, index) => <option key={p.id} value={p.id}>{index + 1} — {p.nom}</option>)}</select></div>
      <div><label>Date d'achat</label><input type="date" value={f.date} onChange={e => setF({ ...f, date: e.target.value })} /></div>
      <div><label>Quantité de sacs</label><input type="number" value={f.qte} onChange={e => setF({ ...f, qte: e.target.value })} /></div>
    </div>
    <div className="row"><button className="btn sec" onClick={onClose}>Annuler</button>
      <button className="btn" onClick={() => f.qte > 0 && f.date ? onSave(f) : alert('Date et quantité obligatoires')}>Enregistrer</button></div>
  </div></div>
}
