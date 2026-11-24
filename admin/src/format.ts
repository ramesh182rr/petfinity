import type { SubmissionStatus } from './api/types'

export const DOC_LABELS: Record<string, string> = {
  identity: 'Government ID',
  vet_registration: 'Veterinary council registration',
  qualification: 'Qualification certificate',
  clinic_registration: 'Clinic registration / trade licence',
  address_proof: 'Address proof',
  other: 'Other document',
}

export const KIND_LABELS: Record<string, string> = {
  veterinarian: 'Veterinarian',
  caretaker: 'Caretaker',
  clinic: 'Clinic',
}

export const STATUS_LABELS: Record<SubmissionStatus, string> = {
  pending: 'Pending review',
  approved: 'Approved',
  needs_info: 'Needs info',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
}

export function statusTone(status: string): string {
  if (status === 'approved' || status === 'verified' || status === 'active') return 'success'
  if (status === 'needs_info' || status === 'pending' || status === 'submitted') return 'warning'
  if (status === 'rejected' || status === 'suspended') return 'error'
  return 'neutral'
}

const dateTime = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' })

export function formatDateTime(iso: string | null | undefined): string {
  return iso ? dateTime.format(new Date(iso)) : '—'
}

export function formatSize(bytes: number | null | undefined): string {
  if (!bytes) return ''
  return bytes < 1_000_000
    ? `${Math.round(bytes / 1000)} KB`
    : `${(bytes / 1_000_000).toFixed(1)} MB`
}
