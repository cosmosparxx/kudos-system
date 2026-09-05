import React, { useEffect, useState } from 'react'

interface User {
  id: string
  name: string
  email: string
  avatar_url?: string
  role?: string
}

interface Kudos {
  id: string
  sender: {
    id: string
    name: string
  }
  recipient: {
    id: string
    name: string
  }
  message: string
  is_anonymous: boolean
  created_at: string
}

export default function KudosDashboard() {
  const [users, setUsers] = useState<User[]>([])
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [search, setSearch] = useState('')
  const [message, setMessage] = useState('')
  const [isAnonymous, setIsAnonymous] = useState(false)

  const [kudos, setKudos] = useState<Kudos[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Search colleagues
  useEffect(() => {
    if (!search.trim()) {
      setUsers([])
      return
    }

    const searchUsers = async () => {
      try {
        setLoadingUsers(true)

        const response = await fetch(
          `http://localhost:3000/api/v1/kudos/users/search?q=${encodeURIComponent(search)}`
        )

        if (!response.ok) {
          throw new Error('Failed to search users')
        }

        const data = await response.json()
        setUsers(data.data || [])
      } catch (err) {
        console.error(err)
        setUsers([])
      } finally {
        setLoadingUsers(false)
      }
    }

    const timeout = setTimeout(searchUsers, 300)

    return () => clearTimeout(timeout)
  }, [search])

  // Load kudos feed
  useEffect(() => {
    const loadKudos = async () => {
      try {
        const response = await fetch(
          'http://localhost:3000/api/v1/kudos/feed'
        )

        if (!response.ok) {
          throw new Error('Failed to load kudos')
        }

        const data = await response.json()
        setKudos(data.data || [])
      } catch (err) {
        console.error(err)
      }
    }

    loadKudos()
  }, [])

  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loginEmail, setLoginEmail] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)

  // Load current user profile if token exists
  useEffect(() => {
    const token = localStorage.getItem('token') || localStorage.getItem('authToken')
    if (!token) return

    fetch('http://localhost:3000/api/v1/users/me/profile', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => {
        if (res.ok) return res.json()
        throw new Error('Token invalid')
      })
      .then((data) => {
        setCurrentUser(data)
      })
      .catch(() => {
        localStorage.removeItem('token')
        localStorage.removeItem('authToken')
        setCurrentUser(null)
      })
  }, [])

  const handleLogin = async (emailToLogin: string) => {
    try {
      setLoggingIn(true)
      setError(null)
      setSuccess(null)
      const res = await fetch('http://localhost:3000/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailToLogin.trim() })
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Login failed')
      }
      localStorage.setItem('token', data.token)
      setCurrentUser(data.user)
      setSuccess(`Logged in as ${data.user.name}! 🎉`)
      setLoginEmail('')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Login failed'
      if (msg.toLowerCase().includes('failed to fetch') || msg.toLowerCase().includes('fetch')) {
        setError('Cannot connect to backend server. Please make sure the backend is running at http://localhost:3000 (run "npm run dev" in the backend directory).')
      } else {
        setError(msg)
      }
    } finally {
      setLoggingIn(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('authToken')
    setCurrentUser(null)
    setSuccess('Logged out successfully.')
  }

  const deleteKudosAdmin = async (kudosId: string) => {
    if (!window.confirm('Are you sure you want to remove this kudos entry?')) {
      return
    }

    try {
      const token = localStorage.getItem('token') || localStorage.getItem('authToken')
      const res = await fetch(`http://localhost:3000/api/v1/kudos/admin/${kudosId}/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ reason: 'Removed by admin' })
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to remove kudos')
      }

      setSuccess('Kudos removed successfully by Admin.')
      setKudos((prev) => prev.filter((k) => k.id !== kudosId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove kudos')
    }
  }

  // Submit kudos
  const submitKudos = async (e: React.FormEvent) => {
    e.preventDefault()

    setError(null)
    setSuccess(null)

    if (!selectedUser) {
      setError('Please select a colleague.')
      return
    }

    if (message.trim().length < 3) {
      setError('Message must be at least 3 characters long.')
      return
    }

    try {
      setSubmitting(true)
      const token = localStorage.getItem('token') || localStorage.getItem('authToken')
      
      if (!token) {
        throw new Error('Authentication required: Please log in using the banner above.')
      }

      const response = await fetch(
        'http://localhost:3000/api/v1/kudos/submit',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            recipient_id: selectedUser.id,
            message: message.trim(),
            is_anonymous: isAnonymous
          })
        }
      )

      const data = await response.json()

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized (401): Access token is missing or expired. Please log in again.')
        }
        const errorMessage =
          data.error ||
          (data.errors && data.errors.map((e: any) => e.message).join(', ')) ||
          data.details ||
          'Failed to submit kudos'
        throw new Error(errorMessage)
      }

      setSuccess('Kudos sent successfully! 🎉')

      setSelectedUser(null)
      setSearch('')
      setMessage('')
      setIsAnonymous(false)

      // Refresh feed
      const feedResponse = await fetch(
        'http://localhost:3000/api/v1/kudos/feed'
      )

      if (feedResponse.ok) {
        const feedData = await feedResponse.json()
        setKudos(feedData.data || [])
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to submit kudos'
      if (msg.toLowerCase().includes('failed to fetch') || msg.toLowerCase().includes('fetch')) {
        setError('Cannot connect to backend server. Please make sure the backend is running at http://localhost:3000 (run "npm run dev" in the backend directory).')
      } else {
        setError(msg)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="kudos-dashboard">

      {/* GIVE KUDOS */}
      <div className="kudos-layout">

        <div className="kudos-form-card">

          <div className="card-glow"></div>

          <div className="card-header">
            <div className="card-icon">✨</div>

            <div>
              <h2>Give Kudos</h2>
              <p>Let someone know their work matters.</p>
            </div>
          </div>

          {/* USER AUTH BANNER */}
          <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
            {currentUser ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <span style={{ fontSize: '0.85rem', opacity: 0.7 }}>LOGGED IN AS</span>
                  <div style={{ fontWeight: 'bold' }}>{currentUser.name} <span style={{ opacity: 0.7, fontWeight: 'normal' }}>({currentUser.email})</span></div>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer' }}
                >
                  Logout
                </button>
              </div>
            ) : (
              <div>
                <span style={{ fontSize: '0.85rem', opacity: 0.8, display: 'block', marginBottom: '8px' }}>🔑 Quick Login (Enter Email):</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="email"
                    placeholder="e.g. anjali@example.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    style={{ flex: 1, padding: '6px 12px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.2)', color: '#fff' }}
                  />
                  <button
                    type="button"
                    disabled={loggingIn || !loginEmail.trim()}
                    onClick={() => handleLogin(loginEmail)}
                    style={{ padding: '6px 16px', borderRadius: '4px', background: '#6366f1', color: '#fff', border: 'none', cursor: 'pointer' }}
                  >
                    {loggingIn ? 'Logging in...' : 'Log In'}
                  </button>
                </div>
                <div style={{ marginTop: '8px', fontSize: '0.8rem', opacity: 0.7 }}>
                  Demo seed users: <button type="button" onClick={() => handleLogin('anjali@example.com')} style={{ background: 'none', border: 'none', color: '#818cf8', textDecoration: 'underline', cursor: 'pointer' }}>anjali@example.com</button> | <button type="button" onClick={() => handleLogin('rahul@example.com')} style={{ background: 'none', border: 'none', color: '#818cf8', textDecoration: 'underline', cursor: 'pointer' }}>rahul@example.com</button>
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="message-alert error-alert">
              ⚠️ {error}
            </div>
          )}

          {success && (
            <div className="message-alert success-alert">
              ✓ {success}
            </div>
          )}

          <form onSubmit={submitKudos}>

            {/* COLLEAGUE */}
            <div className="form-field colleague-field">

              <label>Colleague</label>

              {selectedUser ? (
                <div className="selected-user">

                  <div className="user-avatar">
                    {selectedUser.name.charAt(0).toUpperCase()}
                  </div>

                  <div className="selected-user-info">
                    <strong>{selectedUser.name}</strong>
                    <span>{selectedUser.email}</span>
                  </div>

                  <button
                    type="button"
                    className="remove-user"
                    onClick={() => {
                      setSelectedUser(null)
                      setSearch('')
                    }}
                  >
                    ×
                  </button>

                </div>
              ) : (
                <div className="search-wrapper">

                  <span className="input-icon">⌕</span>

                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search for a colleague..."
                    className="kudos-input search-input"
                  />

                  {loadingUsers && (
                    <div className="search-status">
                      Searching...
                    </div>
                  )}

                  {users.length > 0 && (
                    <div className="user-results">

                      {users.map((user) => (
                        <button
                          key={user.id}
                          type="button"
                          className="user-result"
                          onClick={() => {
                            setSelectedUser(user)
                            setSearch('')
                            setUsers([])
                          }}
                        >

                          <div className="user-avatar">
                            {user.name.charAt(0).toUpperCase()}
                          </div>

                          <div>
                            <strong>{user.name}</strong>
                            <span>{user.email}</span>
                          </div>

                        </button>
                      ))}

                    </div>
                  )}

                  {search.trim() &&
                    !loadingUsers &&
                    users.length === 0 && (
                      <p className="no-results">
                        No colleagues found.
                      </p>
                    )}

                </div>
              )}

            </div>


            {/* MESSAGE */}
            <div className="form-field">

              <label>Message</label>

              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Write something nice..."
                rows={5}
                className="kudos-input kudos-textarea"
              />

            </div>


            {/* ANONYMOUS */}
            <label className="anonymous-option">

              <input
                id="anonymous"
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) =>
                  setIsAnonymous(e.target.checked)
                }
              />

              <span className="custom-checkbox"></span>

              <span>Send anonymously</span>

            </label>


            {/* SUBMIT */}
            <button
              type="submit"
              disabled={submitting}
              className="send-kudos-btn"
            >
              {submitting ? (
                'Sending...'
              ) : (
                <>
                  Send Kudos
                  <span>→</span>
                </>
              )}
            </button>

          </form>

        </div>


        {/* RECENT KUDOS */}
        <div className="recent-kudos">

          <div className="recent-header">

            <div>
              <p className="small-label">COMMUNITY</p>

              <h2>Recent Kudos</h2>
            </div>

            <div className="sparkle">✦</div>

          </div>


          {kudos.length === 0 ? (

            <div className="empty-kudos">

              <div className="empty-icon">♡</div>

              <h3>No kudos yet</h3>

              <p>
                Be the first person to recognize
                someone's amazing work.
              </p>

            </div>

          ) : (

            <div className="kudos-list">

              {kudos.map((item) => (

                <div
                  key={item.id}
                  className="kudos-item"
                >

                  <div className="kudos-item-top">

                    <div className="user-avatar small-avatar">
                      {item.is_anonymous
                        ? '?'
                        : item.sender.name
                            .charAt(0)
                            .toUpperCase()}
                    </div>

                    <div className="kudos-meta">

                      <p>
                        <strong>
                          {item.is_anonymous
                            ? 'Someone'
                            : item.sender.name}
                        </strong>

                        <span> gave kudos to </span>

                        <strong>
                          {item.recipient.name}
                        </strong>
                      </p>

                      <time>
                        {new Date(
                          item.created_at
                        ).toLocaleString()}
                      </time>

                    </div>

                    <span className="heart">♡</span>

                  </div>

                  <div className="kudos-message">
                    “{item.message}”
                  </div>

                  {currentUser?.role === 'admin' && (
                    <div style={{ marginTop: '8px', textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={() => deleteKudosAdmin(item.id)}
                        style={{
                          padding: '4px 10px',
                          fontSize: '0.75rem',
                          background: 'rgba(239, 68, 68, 0.2)',
                          color: '#f87171',
                          border: '1px solid rgba(239, 68, 68, 0.4)',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        🗑️ Remove (Admin)
                      </button>
                    </div>
                  )}

                </div>

              ))}

            </div>

          )}

        </div>

      </div>

    </section>
  )
}