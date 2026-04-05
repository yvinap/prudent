import { Box, Text, Button, Stack, UnstyledButton, Divider } from '@mantine/core'

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  )
}

export default function SignUpScreen({ onBack, onGoogle, onLogin }) {
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

      {/* Content */}
      <Box style={{ flex: 1 }}>
        <Text fw={700} style={{ fontSize: 28, color: '#f1f5f9', marginBottom: 8 }}>
          Create account 🎉
        </Text>
        <Text c="dimmed" mb={36} style={{ fontSize: 15 }}>
          Start your journey to smarter budgeting. It only takes a moment.
        </Text>

        {/* Google button */}
        <Button
          fullWidth
          size="lg"
          radius="xl"
          variant="default"
          leftSection={<GoogleIcon />}
          onClick={onGoogle}
          style={{ height: 52, fontWeight: 600, background: '#1e1e30', borderColor: '#2d2d4a', color: '#f1f5f9' }}
        >
          Continue with Google
        </Button>

        <Divider my={28} label="Secure &amp; private" labelPosition="center" />

        {/* Trust signals */}
        <Stack gap={14}>
          {[
            { icon: '🔐', text: 'Your data is encrypted and secure' },
            { icon: '🚫', text: 'We never sell your personal data' },
            { icon: '🌍', text: 'GDPR compliant and privacy-first' },
          ].map((item) => (
            <Box
              key={item.text}
              style={{ display: 'flex', alignItems: 'center', gap: 12 }}
            >
              <Text style={{ fontSize: 18, flexShrink: 0 }}>{item.icon}</Text>
              <Text style={{ fontSize: 13, color: '#94a3b8' }}>{item.text}</Text>
            </Box>
          ))}
        </Stack>
      </Box>

      {/* Footer */}
      <Box mt={24}>
        <Text c="dimmed" size="sm" ta="center">
          Already have an account?{' '}
          <UnstyledButton
            onClick={onLogin}
            style={{ color: '#009688', fontWeight: 600, fontSize: 14 }}
          >
            Sign in
          </UnstyledButton>
        </Text>
        <Text
          c="dimmed"
          style={{ fontSize: 11, textAlign: 'center', marginTop: 12, lineHeight: 1.5 }}
        >
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </Text>
      </Box>
    </Box>
  )
}
