import { useState } from 'react'
import { Box } from '@mantine/core'
import WelcomeScreen from './screens/WelcomeScreen'
import LoginScreen from './screens/LoginScreen'
import EmailSentScreen from './screens/EmailSentScreen'
import SignUpScreen from './screens/SignUpScreen'
import HomeScreen from './screens/HomeScreen'
import AddTransactionScreen from './screens/AddTransactionScreen'
import ScanReceiptScreen from './screens/ScanReceiptScreen'
import UploadReceiptScreen from './screens/UploadReceiptScreen'
import ViewTransactionsScreen from './screens/ViewTransactionsScreen'

export default function App() {
  const [screen, setScreen] = useState('welcome')

  const navigate = (to) => setScreen(to)

  return (
    <Box
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #080810 0%, #0d1320 50%, #080d10 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <Box
        style={{
          width: '100%',
          maxWidth: '390px',
          height: '844px',
          background: '#111118',
          borderRadius: '24px',
          boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.7)',
          border: '1px solid #1e1e30',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {screen === 'welcome' && (
          <WelcomeScreen
            onLogin={() => navigate('login')}
            onSignUp={() => navigate('signup')}
          />
        )}
        {screen === 'login' && (
          <LoginScreen
            onBack={() => navigate('welcome')}
            onSubmit={() => navigate('emailSent')}
            onSignUp={() => navigate('signup')}
          />
        )}
        {screen === 'emailSent' && (
          <EmailSentScreen
            onBack={() => navigate('login')}
            onRetry={() => navigate('login')}
          />
        )}
        {screen === 'signup' && (
          <SignUpScreen
            onBack={() => navigate('welcome')}
            onGoogle={() => navigate('home')}
            onLogin={() => navigate('login')}
          />
        )}
        {screen === 'home' && (
          <HomeScreen
            onSignOut={() => navigate('welcome')}
            onAddTransaction={() => navigate('addTransaction')}
            onScanReceipt={() => navigate('scanReceipt')}
            onUploadReceipt={() => navigate('uploadReceipt')}
            onViewTransactions={() => navigate('viewTransactions')}
          />
        )}
        {screen === 'addTransaction' && (
          <AddTransactionScreen
            onBack={() => navigate('home')}
            onSave={() => navigate('home')}
          />
        )}
        {screen === 'scanReceipt' && (
          <ScanReceiptScreen
            onBack={() => navigate('home')}
            onDone={() => navigate('home')}
          />
        )}
        {screen === 'uploadReceipt' && (
          <UploadReceiptScreen
            onBack={() => navigate('home')}
            onDone={() => navigate('home')}
          />
        )}
        {screen === 'viewTransactions' && (
          <ViewTransactionsScreen
            onBack={() => navigate('home')}
            onAdd={() => navigate('addTransaction')}
          />
        )}
      </Box>
    </Box>
  )
}
