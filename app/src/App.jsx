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

import './config.js'
import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { MantineProvider } from '@mantine/core'
import '@mantine/core/styles.css'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { api } from './lib/api'
import AppShell from './components/AppShell'
import WelcomeScreen from './screens/WelcomeScreen'
import HomeScreen from './screens/HomeScreen'
import AddTransactionScreen from './screens/AddTransactionScreen'
import QuickAddScreen from './screens/QuickAddScreen'
import BudgetScreen from './screens/BudgetScreen'
import ManageLibraryScreen from './screens/ManageLibraryScreen'
import ScanReceiptScreen from './screens/ScanReceiptScreen'
import UploadReceiptScreen from './screens/UploadReceiptScreen'
import ViewTransactionsScreen from './screens/ViewTransactionsScreen'
import AccountScreen from './screens/AccountScreen'

const INVITE_TOKEN_KEY = 'prudent_pending_invite'

/**
 * When the app mounts with ?invite=TOKEN, store the token for after login.
 * Once the user is authenticated, accept the invite and navigate to /account.
 */
function InviteAcceptor() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => {
    const token = searchParams.get('invite')
    if (token) {
      localStorage.setItem(INVITE_TOKEN_KEY, token)
      // Remove the param from the URL
      searchParams.delete('invite')
      setSearchParams(searchParams, { replace: true })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user) return
    const token = localStorage.getItem(INVITE_TOKEN_KEY)
    if (!token) return
    localStorage.removeItem(INVITE_TOKEN_KEY)
    api.acceptInvite(token)
      .then(() => {
        navigate('/account', { replace: true, state: { inviteAccepted: true } })
      })
      .catch(() => {
        navigate('/account', { replace: true, state: { inviteError: true } })
      })
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}

function Loading() {
  return (
    <AppShell>
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            background: 'linear-gradient(135deg, #009688, #4CAF50)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 28,
            fontWeight: 800,
            color: 'white',
          }}
        >
          P
        </div>
        <p style={{ color: '#475569', fontSize: 14, margin: 0 }}>Loading…</p>
      </div>
    </AppShell>
  )
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <Loading />
  if (!user) return <Navigate to="/" replace />
  return <AppShell>{children}</AppShell>
}

function RootRoute() {
  const { user, loading } = useAuth()
  if (loading) return <Loading />
  if (user) return <Navigate to="/home" replace />
  return (
    <AppShell>
      <WelcomeScreen />
    </AppShell>
  )
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RootRoute />} />
      <Route
        path="/home"
        element={
          <ProtectedRoute>
            <HomeScreen />
          </ProtectedRoute>
        }
      />
      <Route
        path="/add-transaction"
        element={
          <ProtectedRoute>
            <AddTransactionScreen />
          </ProtectedRoute>
        }
      />
      <Route
        path="/quick-add"
        element={
          <ProtectedRoute>
            <QuickAddScreen />
          </ProtectedRoute>
        }
      />
      <Route
        path="/budgets"
        element={
          <ProtectedRoute>
            <BudgetScreen />
          </ProtectedRoute>
        }
      />
      <Route
        path="/library"
        element={
          <ProtectedRoute>
            <ManageLibraryScreen />
          </ProtectedRoute>
        }
      />
      <Route
        path="/scan-receipt"
        element={
          <ProtectedRoute>
            <ScanReceiptScreen />
          </ProtectedRoute>
        }
      />
      <Route
        path="/upload-receipt"
        element={
          <ProtectedRoute>
            <UploadReceiptScreen />
          </ProtectedRoute>
        }
      />
      <Route
        path="/transactions"
        element={
          <ProtectedRoute>
            <ViewTransactionsScreen />
          </ProtectedRoute>
        }
      />
      <Route
        path="/account"
        element={
          <ProtectedRoute>
            <AccountScreen />
          </ProtectedRoute>
        }
      />
      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <MantineProvider defaultColorScheme="dark">
      <AuthProvider>
        <BrowserRouter>
          <InviteAcceptor />
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </MantineProvider>
  )
}
