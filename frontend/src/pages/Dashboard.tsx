import { useEffect, useMemo, useState, type FormEvent } from 'react'
import apiClient from '../utils/api'

type User = { id: string; name: string; email: string; avatar_url?: string; department?: string }
type Kudos = {
  id: string
  sender?: { id: string; name: string; avatar_url?: string }
  recipient: { id: string; name: string; avatar_url?: string }
  message: string
  is_anonymous: boolean
  created_at: string
  is_flagged: boolean
  flag_count: number
}
type FlaggedKudos = Kudos & { sender_name?: string; recipient_name?: string; flags: Array<{ id: string; reason: string; details?: string; created_at: string }>; deleted_at?: string }

function getCurrentUserId() {
  const token = localStorage.getItem('authToken')
  if (!token) return ''
  try { return JSON.parse(atob(token.split('.')[1])).id || '' } catch { return '' }
}

function renderMessage(message: string) {
  const parts = message.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>
    if (part.startsWith('*') && part.endsWith('*')) return <em key={i}>{part.slice(1, -1)}</em>
    return <span key={i}>{part}</span>
  })
}

export default function KudosDashboard() {
  const [kudos, setKudos] = useState<Kudos[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [recipient, setRecipient] = useState('')
  const [message, setMessage] = useState('')
  const [anonymous, setAnonymous] = useState(false)
  const [search, setSearch] = useState('')
  const [userSearch, setUserSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [notifications, setNotifications] = useState(0)
  const [flagTarget, setFlagTarget] = useState<string | null>(null)
  const [flagReason, setFlagReason] = useState('offensive')
  const [adminItems, setAdminItems] = useState<FlaggedKudos[]>([])
  const [adminOpen, setAdminOpen] = useState(false)

  const currentUserId = useMemo(() => getCurrentUserId(), [])

  async function loadFeed(nextPage = page) {
    setLoading(true)
    try {
      const { data } = await apiClient.get('/kudos/feed', { params: { page: nextPage, limit: 10, search } })
      setKudos(data.data); setPages(data.pagination.total_pages); setPage(nextPage); setError('')
    } catch { setError('Could not load the kudos feed.') }
    finally { setLoading(false) }
  }

  async function searchUsers(value: string) {
    setUserSearch(value)
    if (value.trim().length < 1) return setUsers([])
    try { const { data } = await apiClient.get('/kudos/users/search', { params: { q: value, limit: 8 } }); setUsers(data.data) }
    catch { setUsers([]) }
  }

  async function submitKudos(e: FormEvent) {
    e.preventDefault(); setNotice(''); setError('')
    if (!recipient || message.trim().length < 10 || message.trim().length > 500) return setError('Choose a colleague and enter 10–500 characters.')
    setSubmitting(true)
    try {
      await apiClient.post('/kudos/submit', { recipient_id: recipient, message: message.trim(), is_anonymous: anonymous })
      setMessage(''); setRecipient(''); setUserSearch(''); setUsers([]); setAnonymous(false)
      setNotice('Kudos sent! 🎉'); await loadFeed(1)
    } catch (err: any) { setError(err.response?.data?.error || 'Could not submit kudos.') }
    finally { setSubmitting(false) }
  }

  async function reportKudos() {
    if (!flagTarget) return
    try { await apiClient.post(`/kudos/${flagTarget}/flag`, { reason: flagReason }); setNotice('Report submitted for moderation.'); setFlagTarget(null) }
    catch (err: any) { setError(err.response?.data?.error || 'Could not submit report.') }
  }

  async function loadAdmin() {
    try { const { data } = await apiClient.get('/kudos/admin/flagged', { params: { page: 1, limit: 20 } }); setAdminItems(data.data); setAdminOpen(true) }
    catch (err: any) { setError(err.response?.status === 403 ? 'Admin access required.' : 'Could not load moderation queue.') }
  }

  async function moderate(id: string, action: 'hide' | 'delete') {
    try { await apiClient.post(`/kudos/admin/${id}/${action}`, { reason: action === 'hide' ? 'Inappropriate content' : 'Policy violation' }); setNotice(`Kudos ${action}d.`); await loadAdmin(); await loadFeed(page) }
    catch { setError('Moderation action failed.') }
  }

  useEffect(() => { loadFeed(1) }, [search])
  useEffect(() => {
    const loadNotifications = async () => { try { const { data } = await apiClient.get('/kudos/notifications/unread-count'); setNotifications(data.count) } catch {} }
    if (localStorage.getItem('authToken')) { loadNotifications(); const timer = window.setInterval(loadNotifications, 30000); return () => window.clearInterval(timer) }
  }, [])

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 sm:px-6 space-y-6">
      {(notice || error) && <div role="status" className={`rounded-lg p-3 ${error ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>{error || notice}</div>}

      <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div><h2 className="text-xl font-semibold">Give Kudos</h2><p className="text-sm text-gray-500">Celebrate someone’s work.</p></div>
          {notifications > 0 && <span className="text-sm bg-gray-100 rounded-full px-3 py-1">🔔 {notifications} new</span>}
        </div>
        <form onSubmit={submitKudos} className="space-y-4">
          <div>
            <label htmlFor="recipient" className="block text-sm font-medium mb-1">Recipient</label>
            <input id="recipient" value={userSearch} onChange={e => searchUsers(e.target.value)} placeholder="Search a colleague..." className="w-full rounded-lg border px-3 py-2" autoComplete="off" />
            {users.length > 0 && <div className="mt-1 border rounded-lg bg-white divide-y">{users.map(u => <button type="button" key={u.id} onClick={() => { setRecipient(u.id); setUserSearch(u.name); setUsers([]) }} className={`block w-full text-left px-3 py-2 hover:bg-gray-50 ${u.id === currentUserId ? 'hidden' : ''}`}>{u.name} <span className="text-xs text-gray-500">{u.department || u.email}</span></button>)}</div>}
          </div>
          <div>
            <div className="flex justify-between"><label htmlFor="message" className="block text-sm font-medium">Message</label><span className="text-xs text-gray-500">{message.length}/500</span></div>
            <textarea id="message" value={message} onChange={e => setMessage(e.target.value.slice(0, 500))} minLength={10} maxLength={500} rows={4} placeholder="Tell them what they did well..." className="mt-1 w-full rounded-lg border px-3 py-2" />
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={anonymous} onChange={e => setAnonymous(e.target.checked)} /> Send anonymously</label>
          <button disabled={submitting || !recipient || message.trim().length < 10} className="rounded-lg bg-gray-900 text-white px-4 py-2 disabled:opacity-50">{submitting ? 'Sending...' : 'Send Kudos'}</button>
        </form>
      </section>

      <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div><h2 className="text-xl font-semibold">Recent Kudos</h2><p className="text-sm text-gray-500">Newest recognition first.</p></div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search recipient..." className="rounded-lg border px-3 py-2" />
        </div>
        {loading ? <p className="text-gray-500">Loading...</p> : kudos.length === 0 ? <p className="text-gray-500">No kudos yet. Be the first to celebrate someone.</p> : <div className="space-y-3">{kudos.map(k => <article key={k.id} className="border rounded-lg p-4">
          <div className="flex justify-between gap-3"><div className="font-medium">{k.sender ? k.sender.name : 'Anonymous'} → {k.recipient.name}</div><time className="text-xs text-gray-500">{new Date(k.created_at).toLocaleString()}</time></div>
          <p className="mt-2 whitespace-pre-wrap text-gray-700">{renderMessage(k.message)}</p>
          <button onClick={() => setFlagTarget(k.id)} className="mt-3 text-xs text-gray-500 hover:text-red-600">Report</button>
        </article>)}</div>}
        <div className="flex justify-between mt-5"><button disabled={page <= 1} onClick={() => loadFeed(page - 1)} className="border rounded-lg px-3 py-2 disabled:opacity-40">Previous</button><span className="text-sm text-gray-500 py-2">Page {page} of {Math.max(pages, 1)}</span><button disabled={page >= pages} onClick={() => loadFeed(page + 1)} className="border rounded-lg px-3 py-2 disabled:opacity-40">Next</button></div>
      </section>

      <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <button onClick={loadAdmin} className="text-sm font-medium">Open admin moderation queue</button>
        {adminOpen && <div className="mt-4 space-y-3">{adminItems.length === 0 ? <p className="text-sm text-gray-500">No flagged kudos.</p> : adminItems.map(k => <div key={k.id} className="border rounded-lg p-4"><p className="text-sm"><strong>{k.sender?.name || k.sender_name || 'Anonymous'}</strong> → {k.recipient?.name || k.recipient_name}</p><p className="my-2 whitespace-pre-wrap">{k.message}</p><p className="text-xs text-gray-500">Flags: {k.flag_count}</p><div className="mt-3 flex gap-2"><button onClick={() => moderate(k.id, 'hide')} className="border rounded px-3 py-1 text-sm">Hide</button><button onClick={() => moderate(k.id, 'delete')} className="border border-red-300 text-red-700 rounded px-3 py-1 text-sm">Delete</button></div></div>)}</div>}
      </section>

      {flagTarget && <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4"><div className="bg-white rounded-xl p-6 w-full max-w-md"><h3 className="font-semibold text-lg">Report kudos</h3><select value={flagReason} onChange={e => setFlagReason(e.target.value)} className="mt-4 w-full border rounded-lg px-3 py-2"><option value="offensive">Offensive</option><option value="spam">Spam</option><option value="harassment">Harassment</option><option value="irrelevant">Irrelevant</option><option value="other">Other</option></select><div className="mt-4 flex justify-end gap-2"><button onClick={() => setFlagTarget(null)} className="border rounded-lg px-3 py-2">Cancel</button><button onClick={reportKudos} className="bg-gray-900 text-white rounded-lg px-3 py-2">Submit report</button></div></div></div>}
    </div>
  )
}
