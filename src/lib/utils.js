import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export function formatDate(date) {
  if (!date) return '—'
  const d = new Date(date)
  if (isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(d)
}

export function formatDateTime(date) {
  if (!date) return '—'
  const d = new Date(date)
  if (isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

export function formatRelative(date) {
  if (!date) return '—'
  const now = new Date()
  const then = new Date(date)
  if (isNaN(then.getTime())) return '—'
  const diff = now - then
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return formatDate(date)
}

export function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  }).format(value)
}

export function getInitials(name) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function getStatusColor(status) {
  const map = {
    available: 'badge-success',
    borrowed: 'badge-warning',
    maintenance: 'badge-danger',
    reserved: 'badge-info',
    retired: 'badge-neutral',
    'in-use': 'badge-primary',
  }
  return map[status] || 'badge-neutral'
}

export function getConditionColor(condition) {
  const map = {
    excellent: 'badge-success',
    good: 'badge-info',
    fair: 'badge-warning',
    poor: 'badge-danger',
    damaged: 'badge-danger',
  }
  return map[condition] || 'badge-neutral'
}

export function truncate(text, length = 40) {
  if (text.length <= length) return text
  return text.slice(0, length) + '...'
}

export function generateId() {
  return Math.random().toString(36).substring(2, 10)
}

// Keyword → category color. Matched against the item name when no explicit
// `category` is set (the seeded equipment.csv has no category column, so
// most items fall back to name-based inference here).
//
// IMPORTANT: no external image service of any kind (stock photo API, avatar
// generator, placeholder-image host, etc.) — every fallback image is an SVG
// built and encoded in this file at call time, so rendering an item never
// makes a network request and can never surface unrelated or personal
// photos. Do not reintroduce a network-fetched placeholder without explicit
// approval.
const CATEGORY_STYLES = [
  { label: 'Oscilloscope', match: /oscilloscope/i, bg: '2563eb' },
  { label: 'Multimeter', match: /multimeter/i, bg: '7c3aed' },
  { label: 'Arduino', match: /arduino/i, bg: '00979d' },
  { label: 'Raspberry Pi', match: /raspberry\s*pi/i, bg: 'c51a4a' },
  { label: 'Power Supply', match: /power\s*supply/i, bg: 'ea580c' },
  { label: 'Soldering', match: /solder/i, bg: 'b91c1c' },
  { label: 'Breadboard', match: /breadboard/i, bg: '16a34a' },
  { label: 'Sensor', match: /sensor/i, bg: '0891b2' },
  { label: 'Cable', match: /cable|wire|jumper/i, bg: '64748b' },
  { label: 'Motor', match: /motor|servo/i, bg: '9333ea' },
  { label: 'Tool', match: /screwdriver|plier|wrench|\btool\b/i, bg: '525252' },
  { label: '3D Printer', match: /3d\s*print/i, bg: 'db2777' },
  { label: 'Safety Gear', match: /safety|glove|goggle/i, bg: 'ca8a04' },
  { label: 'Camera', match: /camera/i, bg: '4338ca' },
  { label: 'Battery', match: /battery/i, bg: '65a30d' },
  { label: 'PCB', match: /\bpcb\b|circuit board/i, bg: '15803d' },
  { label: 'Microcontroller', match: /microcontroller|esp32|esp8266|stm32/i, bg: '0f766e' },
]

const FALLBACK_PALETTE = ['475569', '7c3aed', '2563eb', '0891b2', '16a34a', 'ca8a04', 'dc2626', '9333ea']

function hashString(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

function escapeXml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Best-effort category label for an item: explicit `category` field first,
 * falling back to keyword matching on the name, then a generic label. */
export function getItemCategoryLabel(item) {
  if (item?.category) return item.category
  const name = item?.name || ''
  const found = CATEGORY_STYLES.find((c) => c.match.test(name))
  return found ? found.label : 'Equipment'
}

/**
 * Fallback image for an item, matched by category: a solid-color box with
 * the category label, rendered as an inline SVG data URI. No network
 * request is made and no third-party image (stock photo, avatar API, etc.)
 * is ever used — this is pure client-side generation from the label string.
 */
export function getPlaceholderImage(item) {
  const label = getItemCategoryLabel(item)
  const known = CATEGORY_STYLES.find((c) => c.label === label)
  const bg = known ? known.bg : FALLBACK_PALETTE[hashString(label) % FALLBACK_PALETTE.length]
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
    <rect width="400" height="300" fill="#${bg}"/>
    <text x="200" y="150" text-anchor="middle" dominant-baseline="middle" fill="#ffffff" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif" font-size="28" font-weight="600">${escapeXml(label)}</text>
  </svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}
