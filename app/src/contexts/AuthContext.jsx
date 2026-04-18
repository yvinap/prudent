import { createContext, useContext, useEffect, useState } from 'react'
import { getCurrentUser } from 'aws-amplify/auth'
import { Hub } from 'aws-amplify/utils'
import { signIn, signOut as doSignOut } from '../lib/auth'
import { api } from '../lib/api'
import { getActiveAccountId, setActiveAccountId } from '../lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [accounts, setAccounts] = useState([])
  const [activeAccount, setActiveAccount] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadSession = async () => {
    try {
      await getCurrentUser()
      const { user: u, accounts: accs } = await api.getMe()
      setUser(u)
      setAccounts(accs || [])

      // Restore previously selected account, or default to first
      const storedId = getActiveAccountId()
      const match = (accs || []).find((a) => a.id === storedId)
      const resolved = match || (accs && accs[0]) || null
      setActiveAccount(resolved)
      setActiveAccountId(resolved?.id ?? null)
    } catch {
      setUser(null)
      setAccounts([])
      setActiveAccount(null)
    } finally {
      setLoading(false)
    }
  }

  const switchAccount = (accountId) => {
    const target = accounts.find((a) => a.id === accountId)
    if (!target) return
    setActiveAccount(target)
    setActiveAccountId(accountId)
  }

  useEffect(() => {
    // During an OAuth callback (?code= in URL) Amplify is mid-exchange.
    // Calling getCurrentUser() at this point hangs until the exchange completes,
    // causing the loading spinner to stick. Skip the eager check and let the
    // Hub 'signInWithRedirect' event (fired when exchange finishes) call loadSession.
    const isOAuthCallback = new URLSearchParams(window.location.search).has('code')
    if (!isOAuthCallback) {
      loadSession()
    }

    const unlisten = Hub.listen('auth', ({ payload }) => {
      // 'signInWithRedirect' fires when the Cognito/Google OAuth code exchange completes.
      // 'signedIn' fires for direct (non-OAuth) sign-ins.
      if (payload.event === 'signInWithRedirect' || payload.event === 'signedIn') {
        loadSession()
      }
      if (payload.event === 'signInWithRedirect_failure') {
        setLoading(false)
      }
      if (payload.event === 'signedOut') {
        setUser(null)
        setAccounts([])
        setActiveAccount(null)
      }
    })
    return unlisten
  }, [])

  const handleSignOut = async () => {
    await doSignOut()
    setUser(null)
    setAccounts([])
    setActiveAccount(null)
    setActiveAccountId(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        accounts,
        activeAccount,
        switchAccount,
        loading,
        signIn,
        signOut: handleSignOut,
        refresh: loadSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
