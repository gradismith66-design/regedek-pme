import { useState, useEffect, useMemo } from 'react'
import { PMES, ACHATS } from './data.js'
import { statutExp, statutActivite } from './status.js'

function useStore(key, init) {
  const [v, setV] = useState(() => { try { return JSON.parse(localStorage.getItem(key)) ?? init } catch { return init } })
  useEffect(() => { localStorage.setItem(key, JSON.stringify(v)) }, [key, v])
  return [v, setV]
}

const Tag = ({ s }) => <span className={`tag ${s.cls}`}>{s.label}</span>
const fmt = (d) => d ? d.split('-').reverse().join('/') : '—'
const normalize = (v) => (v ?? '').toString().trim()
const VIDE = { nom: '', type: 'MENAGE', numAut: '', dateAut: '', expAut: '', dateAgr: '', expAgr: '', contact: '', tel: '', email: '', adresse: '', communes: '', quartiers: '', statutJuridique: '', source: 'saisie manuelle', note: '' }

export default function App() {
  const [pmes, setPmes] = useStore('pmes_v2', PMES)
  const [achats, setAchats] = useStore('achats_v2', ACHATS)
  const [cfg, setCfg] = useStore('cfg', { alerte: 30, inactif: 90 })
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
  const savePme = (p) => { setPmes(p.id ? pmes.map(x => x.id === p.id ? p : x) : [...pmes, { ...p, id: Date.now() }]); setEdit(null) }
  const delPme = (id) => { if (confirm('Supprimer cette PME et ses achats ?')) { setPmes(pmes.filter(p => p.id !== id)); setAchats(achats.filter(a => a.pmeId !== id)); setDetail(null) } }
  const saveAchat = (a) => { setAchats([...achats, { ...a, id: Date.now() }]); setAchatFor(null) }

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
      <h1>REGEDEK · PME AUTORISÉES — REGEDEK & MINISTÈRE</h1>
      <nav>
        {[['dash', 'Tableau de bord'], ['pme', 'PME AUTORISÉES'], ['achats', 'Achats'], ['cfg', 'Réglages']].map(([k, l]) =>
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => { setTab(k); if (k !== 'pme') { setFStatAut(''); setFStatMin('') } }}>{l}</button>)}
      </nav>
    </header>
    <main>
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
        <Table rows={rows.filter(r => r.sAut.label !== 'Valide' || r.sAgr.label !== 'Valide' || r.isIncomplete || r.sAct.label !== 'Active')} onOpen={setDetail} />
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
          <button className="btn" onClick={() => setEdit({ ...VIDE })}>+ Nouvelle PME</button>
          <button className="btn sec" onClick={exportCsv}>Exporter CSV</button>
        </div>
        <Table rows={filtered} onOpen={setDetail} />
      </>}

      {tab === 'achats' && <>
        <div className="bar"><button className="btn" onClick={() => setAchatFor({ pmeId: pmes[0]?.id, date: new Date().toISOString().slice(0, 10), qte: '' })}>+ Enregistrer un achat</button></div>
        <div className="tw"><table><thead><tr><th>Date</th><th>PME</th><th>Quantité</th><th></th></tr></thead><tbody>
          {[...achats].sort((a, b) => b.date.localeCompare(a.date)).map(a => <tr key={a.id}>
            <td>{fmt(a.date)}</td><td>{pmes.find(p => p.id === a.pmeId)?.nom || '?'}</td><td>{Number(a.qte).toLocaleString('fr')}</td>
            <td><button className="btn sec" onClick={() => setAchats(achats.filter(x => x.id !== a.id))}>Suppr.</button></td></tr>)}
        </tbody></table></div>
      </>}

      {tab === 'cfg' && <div className="box" style={{ margin: 0 }}>
        <h2>Règles de statut</h2>
        <div className="grid">
          <div><label>Alerte « À renouveler » (jours avant expiration)</label><input type="number" value={cfg.alerte} onChange={e => setCfg({ ...cfg, alerte: +e.target.value })} /></div>
          <div><label>PME « Inactive » après (jours sans achat)</label><input type="number" value={cfg.inactif} onChange={e => setCfg({ ...cfg, inactif: +e.target.value })} /></div>
        </div>
        <div className="row"><button className="btn red" onClick={() => { if (confirm('Revenir aux données de départ ?')) { setPmes(PMES); setAchats(ACHATS) } }}>Réinitialiser les données</button></div>
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
          <button className="btn red" onClick={() => delPme(r.id)}>Supprimer</button>
          <button className="btn sec" onClick={() => { setDetail(null); setAchatFor({ pmeId: r.id, date: new Date().toISOString().slice(0, 10), qte: '' }) }}>+ Achat</button>
          <button className="btn" onClick={() => { setDetail(null); setEdit(pmes.find(p => p.id === r.id)) }}>Modifier</button>
        </div>
      </div></div>) })()}
  </>)
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
