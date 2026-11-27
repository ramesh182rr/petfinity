import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useSearchParams } from 'react-router'

import { api } from '../api/client'
import type { AdminReview, AdminReviewPage, ReviewStatus } from '../api/types'
import { formatDateTime } from '../format'

const TABS: { value: ReviewStatus; label: string }[] = [
  { value: 'pending', label: 'Needs a decision' },
  { value: 'published', label: 'Published' },
  { value: 'removed', label: 'Removed' },
]

const FLAG_LABELS: Record<string, string> = {
  reported: 'Reported',
  contact_details: 'Contact details',
  link: 'Link',
  language: 'Language',
}

const REASON_LABELS: Record<string, string> = {
  fake: 'Not a real visit',
  abusive: 'Abusive',
  private_info: 'Private details',
  spam: 'Spam',
  other: 'Other',
}

function stars(n: number) {
  return '★'.repeat(n) + '☆'.repeat(5 - n)
}

function ReviewRow({ review, status }: { review: AdminReview; status: ReviewStatus }) {
  const qc = useQueryClient()
  const [note, setNote] = useState('')
  const decide = useMutation({
    mutationFn: (action: 'keep' | 'remove') =>
      api.request(`/admin/reviews/${review.id}/decision`, {
        method: 'POST',
        body: { action, note: note.trim() || null },
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['reviews'] }),
  })
  return (
    <article
      className="card stack"
      style={{ gap: 12 }}
      aria-label={`Review of ${review.listing_name}`}
    >
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div className="stack" style={{ gap: 4 }}>
          <strong>{review.listing_name}</strong>
          <span className="muted small">
            {review.author_name} · {review.author_contact ?? 'no contact'} ·{' '}
            {formatDateTime(review.created_at)}
          </span>
        </div>
        <div className="row" style={{ gap: 8 }}>
          {review.flag_reason ? (
            <span className="chip warning">
              {FLAG_LABELS[review.flag_reason] ?? review.flag_reason}
            </span>
          ) : null}
          <span className="rating" aria-label={`${review.rating} out of 5 stars`}>
            {stars(review.rating)}
          </span>
        </div>
      </div>
      {review.text ? (
        <p className="review-text">{review.text}</p>
      ) : (
        <p className="muted">Rating only, no text.</p>
      )}
      {review.reply_text ? (
        <p className="review-reply">
          <strong>Provider reply:</strong> {review.reply_text}
        </p>
      ) : null}
      {review.reports.length ? (
        <ul className="report-list">
          {review.reports.map((r, i) => (
            <li key={i}>
              <span className="chip error">{REASON_LABELS[r.reason] ?? r.reason}</span>{' '}
              <span className="small">{r.note ?? 'No note'}</span>{' '}
              <span className="muted small">· {formatDateTime(r.created_at)}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {review.moderation_note ? (
        <p className="muted small">Moderator note: {review.moderation_note}</p>
      ) : null}
      {status !== 'removed' ? (
        <div className="stack" style={{ gap: 8 }}>
          <div className="field">
            <label htmlFor={`note-${review.id}`}>Note to the author (shown if removed)</label>
            <input
              id={`note-${review.id}`}
              value={note}
              maxLength={300}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Reviews can't include personal attacks on staff."
            />
          </div>
          <div className="row" style={{ gap: 8 }}>
            {status === 'pending' ? (
              <button
                className="btn btn-success"
                disabled={decide.isPending}
                onClick={() => decide.mutate('keep')}
              >
                Keep and publish
              </button>
            ) : null}
            <button
              className="btn btn-danger"
              disabled={decide.isPending}
              onClick={() => decide.mutate('remove')}
            >
              Remove
            </button>
          </div>
          {decide.isError ? (
            <p role="alert" className="alert error">
              {decide.error.message}
            </p>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}

export function ReviewsPage() {
  const [params, setParams] = useSearchParams()
  const status = (params.get('status') as ReviewStatus | null) ?? 'pending'
  const query = useQuery({
    queryKey: ['reviews', status],
    queryFn: () => api.request<AdminReviewPage>(`/admin/reviews?status=${status}`),
  })

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="page-hero">
        <p className="eyebrow">Trust & safety</p>
        <h1>Reviews</h1>
        <p className="muted">
          Reviews publish straight away. Reported or auto-flagged ones wait here, hidden, until you
          decide.
        </p>
        <div className="hero-stats">
          <div className="hero-stat">
            <strong>{status === 'pending' && query.data ? query.data.items.length : '–'}</strong>
            <span>Waiting for a decision</span>
          </div>
          <div className="hero-stat">
            <strong>1 report</strong>
            <span>Hides a review</span>
          </div>
        </div>
      </div>
      <div className="tabs" role="tablist" aria-label="Review status">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            role="tab"
            aria-selected={tab.value === status}
            onClick={() => setParams({ status: tab.value })}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {query.isPending ? (
        <div className="stack" aria-label="Loading">
          {[0, 1].map((i) => (
            <div key={i} className="skeleton" style={{ height: 120 }} />
          ))}
        </div>
      ) : query.isError ? (
        <div className="card stack">
          <p role="alert" className="alert error">
            Couldn&apos;t load reviews. {query.error.message}
          </p>
          <button className="btn btn-secondary" onClick={() => void query.refetch()}>
            Try again
          </button>
        </div>
      ) : query.data.items.length === 0 ? (
        <div
          className="card stack"
          style={{ padding: 32, alignItems: 'center', textAlign: 'center' }}
        >
          <h2>{status === 'pending' ? 'All caught up' : 'Nothing here'}</h2>
          <p className="muted">
            {status === 'pending'
              ? 'No reviews are waiting for a decision.'
              : 'No reviews in this list.'}
          </p>
        </div>
      ) : (
        <div className="stack" style={{ gap: 12 }}>
          {query.data.items.map((review) => (
            <ReviewRow key={review.id} review={review} status={status} />
          ))}
        </div>
      )}
    </div>
  )
}
