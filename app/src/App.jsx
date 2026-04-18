import './config.js'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { MantineProvider } from '@mantine/core'
import '@mantine/core/styles.css'
import { AuthProvider, useAuth } from './contexts/AuthContext'
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
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </MantineProvider>
  )
}
