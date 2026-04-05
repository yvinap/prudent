import { Box, Text, Button, Stack, UnstyledButton } from '@mantine/core'

export default function EmailSentScreen({ onBack, onRetry }) {
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

      {/* Centered content */}
      <Box
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
        }}
      >
        <Box
          style={{
            width: 100,
            height: 100,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #0d2420, #0f3028)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 44,
            marginBottom: 32,
          }}
        >
          ✉️
        </Box>

        <Text fw={700} style={{ fontSize: 28, color: '#f1f5f9', marginBottom: 12 }}>
          Check your inbox
        </Text>

        <Text c="dimmed" style={{ fontSize: 15, maxWidth: 280, lineHeight: 1.6 }}>
          We've sent a magic sign-in link to your email. Click the link to continue.
        </Text>

        <Box
          mt={32}
          style={{
            width: '100%',
            padding: '16px',
            background: '#0d2420',
            borderRadius: '12px',
            border: '1px solid #1a4a40',
          }}
        >
          <Text style={{ fontSize: 13, color: '#4db6ac', textAlign: 'left' }}>
            💡 The link expires in 15 minutes. Check your spam folder if you don't see it.
          </Text>
        </Box>
      </Box>

      {/* Actions */}
      <Stack gap={12} mt={32}>
        <Button
          fullWidth
          size="lg"
          radius="xl"
          variant="outline"
          color="teal"
          onClick={onRetry}
          style={{ height: 52, borderColor: '#00796b', color: '#4db6ac' }}
        >
          Resend magic link
        </Button>
      </Stack>
    </Box>
  )
}
