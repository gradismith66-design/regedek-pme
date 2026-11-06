const DAY = 86400000
export const daysUntil = (iso) => iso ? Math.ceil((new Date(iso) - new Date().setHours(0,0,0,0)) / DAY) : null
export const daysSince = (iso) => iso ? Math.floor((new Date().setHours(0,0,0,0) - new Date(iso)) / DAY) : null

// Statut d'une date d'expiration (agrément ou autorisation)
export function statutExp(exp, alerte) {
  const d = daysUntil(exp)
  if (d === null) return { label: 'Non renseigné', cls: 'gris', jours: null }
  if (d < 0) return { label: 'Expiré', cls: 'rouge', jours: d }
  if (d <= alerte) return { label: 'À renouveler', cls: 'orange', jours: d }
  return { label: 'Valide', cls: 'vert', jours: d }
}
// Statut d'activité selon le dernier achat de sacs
export function statutActivite(dernier, seuil) {
  const d = daysSince(dernier)
  if (d === null) return { label: 'Aucun achat', cls: 'gris', jours: null }
  if (d > seuil) return { label: 'Inactive', cls: 'rouge', jours: d }
  return { label: 'Active', cls: 'vert', jours: d }
}
