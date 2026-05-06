// Copyright (C) 2026 V.P.
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program. If not, see <https://www.gnu.org/licenses/>.

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
