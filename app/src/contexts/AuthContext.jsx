import { createContext, useContext, useEffect, useState } from 'react'
import { getCurrentUser } from 'aws-amplify/auth'
import { Hub } from 'aws-amplify/utils'
import { signIn, signOut as doSignOut } from '../lib/auth'
import { api } from '../lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [account, setAccount] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadSession = async () => {
    try {
      await getCurrentUser()
      const { user: u, account: a } = await api.getMe()
      setUser(u)
      setAccount(a)
    } catch {
      setUser(null)
      setAccount(null)
    } finally {
      setLoading(false)
    }
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
        setAccount(null)
      }
    })
    return unlisten
  }, [])

  const handleSignOut = async () => {
    await doSignOut()
    setUser(null)
    setAccount(null)
  }

  return (
    <AuthContext.Provider
      value={{ user, account, loading, signIn, signOut: handleSignOut, refresh: loadSession }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
