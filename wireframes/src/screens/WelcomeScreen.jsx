import { Box, Text, Button, Stack, Group } from '@mantine/core'

export default function WelcomeScreen({ onLogin, onSignUp }) {
  return (
    <Box
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        padding: '48px 32px',
      }}
    >
      {/* Hero */}
      <Box
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Box
          style={{
            width: 88,
            height: 88,
            borderRadius: '24px',
            background: 'linear-gradient(135deg, #009688, #4CAF50)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 24,
            boxShadow: '0 8px 24px rgba(0, 150, 136, 0.35)',
          }}
        >
          <Text fw={800} c="white" style={{ fontSize: 40 }}>P</Text>
        </Box>

        <Text
          fw={800}
          ta="center"
          style={{ fontSize: 36, letterSpacing: '-0.5px', color: '#f1f5f9' }}
        >
          Prudent
        </Text>

        <Text c="dimmed" ta="center" mt={8} style={{ fontSize: 16, maxWidth: 260 }}>
          Smart budgeting for a better financial future
        </Text>

        {/* Feature hints */}
        <Box mt={48} style={{ width: '100%' }}>
          {[
            { icon: '💰', label: 'Track income & expenses' },
            { icon: '📊', label: 'Visualize your spending' },
            { icon: '🎯', label: 'Reach your savings goals' },
          ].map((item) => (
            <Group key={item.label} gap={12} mb={16}>
              <Box
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '12px',
                  background: '#1a2a28',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18,
                  flexShrink: 0,
                }}
              >
                {item.icon}
              </Box>
              <Text style={{ color: '#cbd5e1', fontWeight: 500 }}>{item.label}</Text>
            </Group>
          ))}
        </Box>
      </Box>

      {/* Actions */}
      <Stack gap={12} mt={32}>
        <Button
          fullWidth
          size="lg"
          radius="xl"
          onClick={onSignUp}
          style={{
            background: 'linear-gradient(135deg, #009688, #4CAF50)',
            height: 52,
            border: 'none',
          }}
        >
          Get Started
        </Button>
        <Button
          fullWidth
          size="lg"
          radius="xl"
          variant="outline"
          color="teal"
          onClick={onLogin}
          style={{ height: 52, borderColor: '#00796b', color: '#4db6ac' }}
        >
          Sign In
        </Button>
      </Stack>
    </Box>
  )
}
