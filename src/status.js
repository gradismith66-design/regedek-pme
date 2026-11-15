const DAY = 86400000
const dateOnlyUtc = (value) => {
  if (!value) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return Number.NaN
  const [, year, month, day] = match.map(Number)
  const timestamp = Date.UTC(year, month - 1, day)
  const parsed = new Date(timestamp)
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day
    ? timestamp
    : Number.NaN
}
const todayUtc = () => {
  const today = new Date()
  return Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
}
export const daysUntil = (iso) => {
  const date = dateOnlyUtc(iso)
  return date === null ? null : (date - todayUtc()) / DAY
}
export const daysSince = (iso) => {
  const date = dateOnlyUtc(iso)
  return date === null ? null : (todayUtc() - date) / DAY
}

// Statut d'une date d'expiration (agrément ou autorisation)
export function statutExp(exp, alerte) {
  const d = daysUntil(exp)
  if (d === null) return { label: 'Non renseigné', cls: 'gris', jours: null }
  if (!Number.isFinite(d)) return { label: 'À vérifier', cls: 'orange', jours: null }
  if (d < 0) return { label: 'Expiré', cls: 'rouge', jours: d }
  if (d <= alerte) return { label: 'À renouveler', cls: 'orange', jours: d }
  return { label: 'Valide', cls: 'vert', jours: d }
}
// Statut d'activité selon le dernier achat de sacs
export function statutActivite(dernier, seuil) {
  const d = daysSince(dernier)
  if (d === null) return { label: 'Aucun achat', cls: 'gris', jours: null }
  if (!Number.isFinite(d)) return { label: 'À vérifier', cls: 'orange', jours: null }
  if (d > seuil) return { label: 'Inactive', cls: 'rouge', jours: d }
  return { label: 'Active', cls: 'vert', jours: d }
}
