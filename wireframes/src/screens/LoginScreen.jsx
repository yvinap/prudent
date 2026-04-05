import { useState } from 'react'
import { Box, Text, Button, TextInput, Stack, UnstyledButton } from '@mantine/core'

export default function LoginScreen({ onBack, onSubmit, onSignUp }) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = () => {
    if (!email.trim()) {
      setError('Please enter your email address')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address')
      return
    }
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      onSubmit()
    }, 900)
  }

  return (
    <Box
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        padding: '24px 32px 48px',
      }}
    >
      {/* Back */}
      <Box mb={8}>
        <UnstyledButton
          onClick={onBack}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            color: '#009688',
            fontWeight: 600,
            fontSize: 14,
            padding: '8px 0',
          }}
        >
          ← Back
        </UnstyledButton>
      </Box>

      {/* Logo row */}
      <Box style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 40 }}>
        <Box
          style={{
            width: 44,
            height: 44,
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #009688, #4CAF50)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text fw={800} c="white" size="lg">P</Text>
        </Box>
        <Text fw={700} size="lg" style={{ color: '#f1f5f9' }}>Prudent</Text>
      </Box>

      {/* Form */}
      <Box style={{ flex: 1 }}>
        <Text fw={700} style={{ fontSize: 28, color: '#f1f5f9', marginBottom: 8 }}>
          Welcome back 👋
        </Text>
        <Text c="dimmed" mb={36} style={{ fontSize: 15 }}>
          Enter your email to receive a secure sign-in link.
        </Text>

        <Stack gap={20}>
          <TextInput
            label="Email address"
            placeholder="you@example.com"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setError('')
            }}
            error={error}
            size="md"
            radius="md"
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            styles={{ label: { fontWeight: 600, color: '#94a3b8', marginBottom: 6 } }}
          />
          <Button
            fullWidth
            size="lg"
            radius="xl"
            loading={loading}
            onClick={handleSubmit}
            style={{
              background: 'linear-gradient(135deg, #009688, #4CAF50)',
              height: 52,
              border: 'none',
            }}
          >
            Continue with Email
          </Button>
        </Stack>

        <Box
          mt={24}
          style={{
            padding: '14px 16px',
            background: '#0d2420',
            borderRadius: '12px',
            border: '1px solid #1a4a40',
          }}
        >
          <Text style={{ fontSize: 13, color: '#4db6ac' }}>
            🔒 We'll send a magic link to your email — no password needed.
          </Text>
        </Box>
      </Box>

      {/* Footer */}
      <Box ta="center" mt={24}>
        <Text c="dimmed" size="sm">
          Don't have an account?{' '}
          <UnstyledButton
            onClick={onSignUp}
            style={{ color: '#009688', fontWeight: 600, fontSize: 14 }}
          >
            Sign up
          </UnstyledButton>
        </Text>
      </Box>
    </Box>
  )
}
