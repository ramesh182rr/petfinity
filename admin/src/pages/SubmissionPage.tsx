import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'

import { api, ApiError, resolveUrl } from '../api/client'
import type { Decision, ReviewDocument, SubmissionDetail } from '../api/types'
import {
  DOC_LABELS,
  formatDateTime,
  formatSize,
  KIND_LABELS,
  STATUS_LABELS,
  statusTone,
} from '../format'

function Facts({ rows }: { rows: [string, string | number | boolean | null | undefined][] }) {
  return (
    <dl className="facts">
      {rows
        .filter(([, v]) => v !== null && v !== undefined && v !== '')
        .map(([k, v]) => (
          <div key={k} style={{ display: 'contents' }}>
            <dt>{k}</dt>
            <dd>{typeof v === 'boolean' ? (v ? 'Yes' : 'No') : v}</dd>
          </div>
        ))}
    </dl>
  )
}

function DocumentViewer({ doc }: { doc: ReviewDocument }) {
  const url = resolveUrl(doc.url)
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="viewer">
        {doc.content_type === 'application/pdf' ? (
          <iframe
            title={DOC_LABELS[doc.doc_type]}
            src={url}
            style={{ width: '100%', height: '100%', border: 0 }}
          />
        ) : (
          <img src={url} alt={DOC_LABELS[doc.doc_type]} />
        )}
      </div>
      <a href={url} target="_blank" rel="noreferrer noopener" className="small">
        Open in a new tab ↗
      </a>
    </div>
  )
}

function DecisionPanel({ submission }: { submission: SubmissionDetail }) {
  const [decision, setDecision] = useState<Decision>('approve')
  const [reason, setReason] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const mutation = useMutation({
    mutationFn: () =>
      api.request(`/admin/verification/submissions/${submission.id}/decision`, {
        method: 'POST',
        body: { decision, reason: reason.trim() || null },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['queue'] })
      navigate('/verification', {
        state: {
          notice: `Decision recorded for this ${KIND_LABELS[submission.provider?.provider_type ?? 'clinic']?.toLowerCase()}.`,
        },
      })
    },
  })

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (decision !== 'approve' && reason.trim().length < 5) {
      setFormError('Please explain what is missing or why; the applicant will see this message.')
      return
    }
    setFormError(null)
    mutation.mutate()
  }

  return (
    <form className="card stack" onSubmit={onSubmit} aria-label="Decision">
      <h2>Decision</h2>
      <p className="small muted">
        Approving gives a <strong>verified</strong> badge meaning: identity and the listed documents
        were checked by Petfinity. It is not a guarantee of service quality.
      </p>
      <div className="stack" style={{ gap: 8 }} role="radiogroup" aria-label="Decision">
        {(
          [
            ['approve', 'Approve', 'Documents match the details. Mark as verified.'],
            ['needs_info', 'Ask for more information', 'e.g. a document is unclear or missing.'],
            ['reject', 'Reject', 'The documents are invalid or don’t belong to the applicant.'],
          ] as const
        ).map(([value, label, hint]) => (
          <label key={value} className="choice">
            <input
              type="radio"
              name="decision"
              value={value}
              checked={decision === value}
              onChange={() => setDecision(value)}
            />
            <span>
              <strong>{label}</strong>
              <br />
              <span className="small muted">{hint}</span>
            </span>
          </label>
        ))}
      </div>
      <div className="field">
        <label htmlFor="reason">
          Message to applicant {decision === 'approve' ? '(optional)' : '(required)'}
        </label>
        <textarea
          id="reason"
          rows={3}
          maxLength={1000}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        {formError ? (
          <span className="error" role="alert">
            {formError}
          </span>
        ) : null}
      </div>
      {mutation.isError ? (
        <p role="alert" className="alert error">
          {mutation.error instanceof ApiError
            ? mutation.error.message
            : 'Could not save the decision.'}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={mutation.isPending}
        className={`btn ${decision === 'approve' ? 'btn-success' : decision === 'reject' ? 'btn-danger' : 'btn-primary'}`}
      >
        {mutation.isPending
          ? 'Saving…'
          : decision === 'approve'
            ? 'Approve and verify'
            : decision === 'reject'
              ? 'Reject'
              : 'Send back for more information'}
      </button>
    </form>
  )
}

function StatusPanel({ submission }: { submission: SubmissionDetail }) {
  const subject = submission.provider ?? submission.clinic
  const [reason, setReason] = useState('')
  const queryClient = useQueryClient()
  const suspended = subject?.status === 'suspended'
  const mutation = useMutation({
    mutationFn: () =>
      api.request(
        `/admin/verification/${submission.subject_type}/${submission.subject_id}/status`,
        {
          method: 'POST',
          body: { status: suspended ? 'active' : 'suspended', reason: reason.trim() },
        },
      ),
    onSuccess: async () => {
      setReason('')
      await queryClient.invalidateQueries({ queryKey: ['submission', submission.id] })
    },
  })
  if (!subject) return null
  return (
    <div className="card stack">
      <div className="row spread">
        <h2>Account status</h2>
        <span className={`chip ${statusTone(subject.status)}`}>{subject.status}</span>
      </div>
      <p className="small muted">
        Suspended providers are hidden from search and can&apos;t take bookings.
      </p>
      <div className="field">
        <label htmlFor="status-reason">Reason (kept in the audit log)</label>
        <input
          id="status-reason"
          value={reason}
          maxLength={500}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
      {mutation.isError ? (
        <p role="alert" className="alert error">
          {mutation.error.message}
        </p>
      ) : null}
      <button
        className={`btn ${suspended ? 'btn-secondary' : 'btn-danger'}`}
        disabled={reason.trim().length < 3 || mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        {suspended ? 'Reactivate' : 'Suspend'}
      </button>
    </div>
  )
}

export function SubmissionPage() {
  const { id = '' } = useParams()
  const [selected, setSelected] = useState(0)
  const query = useQuery({
    queryKey: ['submission', id],
    queryFn: () => api.request<SubmissionDetail>(`/admin/verification/submissions/${id}`),
    staleTime: 0,
    // Document links expire after 5 minutes; refresh them a little before.
    refetchInterval: 4 * 60_000,
  })

  if (query.isPending)
    return <div className="skeleton" style={{ height: 320 }} aria-label="Loading" />
  if (query.isError) {
    return (
      <div className="stack">
        <p role="alert" className="alert error">
          {query.error.message}
        </p>
        <Link to="/verification">← Back to queue</Link>
      </div>
    )
  }
  const s = query.data
  const p = s.provider
  const c = s.clinic
  const doc = s.documents[selected] ?? s.documents[0]

  return (
    <div className="stack" style={{ gap: 20 }}>
      <Link to="/verification" className="small">
        ← Back to queue
      </Link>
      <div className="row spread">
        <div className="stack" style={{ gap: 4 }}>
          <h1>{p?.display_name ?? c?.name ?? 'Submission'}</h1>
          <p className="muted">
            {KIND_LABELS[p?.provider_type ?? 'clinic']} · submitted {formatDateTime(s.submitted_at)}
          </p>
        </div>
        <span className={`chip ${statusTone(s.status)}`}>{STATUS_LABELS[s.status]}</span>
      </div>

      <div className="review-grid">
        <div className="stack">
          <div className="card stack">
            <h2>Details</h2>
            {p ? (
              <Facts
                rows={[
                  ['Display name', p.display_name],
                  ['Registration no.', p.registration_number],
                  ['Council', p.registration_council],
                  ['Qualifications', p.qualifications],
                  ['Experience', p.years_experience != null ? `${p.years_experience} years` : null],
                  ['City', p.city],
                  ['Languages', p.languages.join(', ')],
                  ['Bio', p.bio],
                ]}
              />
            ) : c ? (
              <Facts
                rows={[
                  ['Name', c.name],
                  ['Phone', c.phone],
                  ['Email', c.email],
                  [
                    'Address',
                    [c.address_line1, c.address_line2, c.locality].filter(Boolean).join(', '),
                  ],
                  ['City / State', `${c.city}, ${c.state} ${c.postal_code}`],
                  ['Location', c.latitude ? `${c.latitude}, ${c.longitude}` : null],
                  ['Emergency services', c.emergency_services],
                ]}
              />
            ) : (
              <p className="muted">The profile no longer exists.</p>
            )}
          </div>
          <div className="card stack">
            <h2>Applicant</h2>
            <Facts
              rows={[
                ['Name', s.submitter?.display_name],
                ['Email', s.submitter?.email],
                ['Phone', s.submitter?.phone],
              ]}
            />
            {s.applicant_note ? <p className="alert info">“{s.applicant_note}”</p> : null}
          </div>
          {s.history.length ? (
            <div className="card stack">
              <h2>Previous submissions</h2>
              {s.history.map((h) => (
                <div key={h.id} className="stack" style={{ gap: 2 }}>
                  <div className="row">
                    <span className={`chip ${statusTone(h.status)}`}>
                      {STATUS_LABELS[h.status]}
                    </span>
                    <span className="small muted">{formatDateTime(h.submitted_at)}</span>
                  </div>
                  {h.decision_reason ? <p className="small">{h.decision_reason}</p> : null}
                </div>
              ))}
            </div>
          ) : null}
          {s.status === 'pending' ? (
            <DecisionPanel submission={s} />
          ) : (
            <div className="card stack">
              <h2>Decision</h2>
              <p>
                {STATUS_LABELS[s.status]} by{' '}
                {s.reviewer?.display_name ?? s.reviewer?.email ?? 'an admin'} ·{' '}
                {formatDateTime(s.reviewed_at)}
              </p>
              {s.decision_reason ? <p className="muted">{s.decision_reason}</p> : null}
            </div>
          )}
          <StatusPanel submission={s} />
        </div>

        <div className="card stack">
          <div className="row spread">
            <h2>Documents</h2>
            <button className="btn btn-tertiary small" onClick={() => void query.refetch()}>
              Refresh links
            </button>
          </div>
          <p className="small muted">
            Private. Links expire after 5 minutes and each view is logged.
          </p>
          {s.documents.length === 0 ? (
            <p className="muted">No documents in this submission.</p>
          ) : (
            <>
              <div className="stack doc-list" style={{ gap: 8 }}>
                {s.documents.map((d, i) => (
                  <button key={d.id} aria-pressed={d === doc} onClick={() => setSelected(i)}>
                    <strong>{DOC_LABELS[d.doc_type] ?? d.doc_type}</strong>
                    <span className="small muted">
                      {' '}
                      · {d.content_type === 'application/pdf' ? 'PDF' : 'Image'}{' '}
                      {formatSize(d.size_bytes)}
                    </span>
                  </button>
                ))}
              </div>
              {doc ? <DocumentViewer doc={doc} /> : null}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
