import { useQuery } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router'

import { api } from '../api/client'
import type { QueuePage as Page, SubmissionStatus } from '../api/types'
import { formatDateTime, KIND_LABELS, STATUS_LABELS } from '../format'

const TABS: SubmissionStatus[] = ['pending', 'needs_info', 'approved', 'rejected']

export function QueuePage() {
  const [params, setParams] = useSearchParams()
  const status = (params.get('status') as SubmissionStatus | null) ?? 'pending'
  const navigate = useNavigate()
  const query = useQuery({
    queryKey: ['queue', status],
    queryFn: () => api.request<Page>(`/admin/verification/submissions?status=${status}`),
  })

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="page-hero">
        <p className="eyebrow">Trust & safety</p>
        <h1>Verification</h1>
        <p className="muted">
          Review vets, caretakers and clinics before they can be listed or booked.
        </p>
        <div className="hero-stats">
          <div className="hero-stat">
            <strong>{status === 'pending' && query.data ? query.data.items.length : '–'}</strong>
            <span>Waiting for review</span>
          </div>
          <div className="hero-stat">
            <strong>5 min</strong>
            <span>Document link lifetime</span>
          </div>
        </div>
      </div>
      <div className="tabs" role="tablist" aria-label="Submission status">
        {TABS.map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={tab === status}
            onClick={() => setParams({ status: tab })}
          >
            {STATUS_LABELS[tab]}
          </button>
        ))}
      </div>

      <div className="card" style={{ padding: 8 }}>
        {query.isPending ? (
          <div className="stack" style={{ padding: 12 }} aria-label="Loading">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton" style={{ height: 44 }} />
            ))}
          </div>
        ) : query.isError ? (
          <div className="stack" style={{ padding: 16 }}>
            <p role="alert" className="alert error">
              Couldn&apos;t load the queue. {query.error.message}
            </p>
            <button className="btn btn-secondary" onClick={() => void query.refetch()}>
              Try again
            </button>
          </div>
        ) : query.data.items.length === 0 ? (
          <div className="stack" style={{ padding: 32, alignItems: 'center', textAlign: 'center' }}>
            <h2>{status === 'pending' ? 'All caught up' : 'Nothing here yet'}</h2>
            <p className="muted">
              {status === 'pending'
                ? 'No submissions are waiting for review.'
                : `No ${STATUS_LABELS[status].toLowerCase()} submissions.`}
            </p>
          </div>
        ) : (
          <table className="list">
            <thead>
              <tr>
                <th>Applicant</th>
                <th>Type</th>
                <th>City</th>
                <th>Contact</th>
                <th>Submitted</th>
              </tr>
            </thead>
            <tbody>
              {query.data.items.map((item) => (
                <tr
                  key={item.id}
                  className="clickable"
                  tabIndex={0}
                  onClick={() => navigate(`/verification/${item.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') navigate(`/verification/${item.id}`)
                  }}
                >
                  <td>
                    <strong>{item.subject_label}</strong>
                  </td>
                  <td>
                    <span className="chip">
                      {KIND_LABELS[item.subject_kind] ?? item.subject_kind}
                    </span>
                  </td>
                  <td>{item.city ?? '—'}</td>
                  <td className="small">{item.submitter?.email ?? item.submitter?.phone ?? '—'}</td>
                  <td className="small">{formatDateTime(item.submitted_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
