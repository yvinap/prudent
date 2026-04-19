import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Box, Text, Group, TextInput, Button, Badge, ActionIcon } from '@mantine/core'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../lib/api'

const TEAL = '#009688'
const SURFACE = '#1a1a2e'
const BORDER = '#2d2d4a'
const MUTED = '#64748b'
const DANGER = '#ef4444'

function SectionHeader({ children }) {
  return (
    <Text
      style={{
        fontSize: 11,
        fontWeight: 700,
        color: MUTED,
        letterSpacing: 1,
        textTransform: 'uppercase',
        marginBottom: 10,
        marginTop: 24,
      }}
    >
      {children}
    </Text>
  )
}

function Card({ children, style }) {
  return (
    <Box
      style={{
        background: SURFACE,
        border: `1px solid ${BORDER}`,
        borderRadius: 12,
        padding: '14px 16px',
        ...style,
      }}
    >
      {children}
    </Box>
  )
}

function MemberRow({ member, isPrimary }) {
  const initials =
    ((member.firstName?.[0] || '') + (member.lastName?.[0] || '')).toUpperCase() || '?'
  return (
    <Group justify="space-between" align="center" py={8} style={{ borderBottom: `1px solid ${BORDER}` }}>
      <Group gap={10}>
        <Box
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            background: isPrimary ? TEAL : '#334155',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Text fw={700} style={{ fontSize: 12, color: 'white' }}>{initials}</Text>
        </Box>
        <Box>
          <Text style={{ fontSize: 13, color: '#cbd5e1', fontWeight: 600 }}>
            {member.firstName} {member.lastName}
          </Text>
          <Text style={{ fontSize: 11, color: MUTED }}>{member.email}</Text>
        </Box>
      </Group>
      <Badge
        size="xs"
        radius="xl"
        style={{
          background: isPrimary ? '#0d2018' : '#1e1e30',
          color: isPrimary ? '#4ade80' : MUTED,
          border: `1px solid ${isPrimary ? '#166534' : BORDER}`,
        }}
      >
        {isPrimary ? 'Owner' : 'Member'}
      </Badge>
    </Group>
  )
}

function InviteRow({ invite, onRevoke }) {
  const [revoking, setRevoking] = useState(false)
  const handleRevoke = async () => {
    setRevoking(true)
    try {
      await onRevoke(invite.inviteId)
    } finally {
      setRevoking(false)
    }
  }
  const expiresDate = new Date(invite.expiresAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
  return (
    <Group justify="space-between" align="center" py={8} style={{ borderBottom: `1px solid ${BORDER}` }}>
      <Box>
        <Text style={{ fontSize: 13, color: '#cbd5e1' }}>
          {invite.label || 'Invite link'}
        </Text>
        <Text style={{ fontSize: 11, color: MUTED }}>Expires {expiresDate}</Text>
      </Box>
      <ActionIcon
        size="sm"
        variant="subtle"
        color="red"
        loading={revoking}
        onClick={handleRevoke}
        title="Revoke invite"
      >
        ✕
      </ActionIcon>
    </Group>
  )
}

function AccountSwitcherSection({ accounts, activeAccount, switchAccount }) {
  if (accounts.length === 0) return null
  return (
    <>
      <SectionHeader>Your Accounts</SectionHeader>
      <Card>
        {accounts.map((acc, idx) => (
          <Group
            key={acc.id}
            justify="space-between"
            align="center"
            py={8}
            style={{
              borderBottom: idx < accounts.length - 1 ? `1px solid ${BORDER}` : 'none',
              cursor: acc.id !== activeAccount?.id ? 'pointer' : 'default',
            }}
            onClick={() => {
              if (acc.id !== activeAccount?.id) switchAccount(acc.id)
            }}
          >
            <Group gap={10}>
              <Box
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  background: acc.id === activeAccount?.id ? TEAL : MUTED,
                  flexShrink: 0,
                }}
              />
              <Text style={{ fontSize: 14, color: '#cbd5e1', fontWeight: acc.id === activeAccount?.id ? 700 : 400 }}>
                {acc.name}
              </Text>
            </Group>
            {acc.id === activeAccount?.id && (
              <Text style={{ fontSize: 11, color: TEAL }}>Active</Text>
            )}
          </Group>
        ))}
      </Card>
    </>
  )
}

export default function AccountScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  const { accounts, activeAccount, switchAccount, refresh, signOut } = useAuth()

  const inviteAccepted = location.state?.inviteAccepted
  const inviteError = location.state?.inviteError

  const [accountDetail, setAccountDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Invite creation
  const [inviteLabel, setInviteLabel] = useState('')
  const [creating, setCreating] = useState(false)
  const [inviteUrl, setInviteUrl] = useState(null)
  const [copied, setCopied] = useState(false)

  // New account
  const [newAccountName, setNewAccountName] = useState('')
  const [creatingAccount, setCreatingAccount] = useState(false)

  const loadDetail = useCallback(() => {
    setLoading(true)
    setError(null)
    api.getAccount()
      .then(setAccountDetail)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadDetail() }, [loadDetail])

  const handleCreateInvite = async () => {
    setCreating(true)
    setInviteUrl(null)
    try {
      const res = await api.createInvite({ label: inviteLabel.trim() || undefined })
      setInviteUrl(res.inviteUrl)
      setInviteLabel('')
      loadDetail()
    } catch (e) {
      setError(e.message)
    } finally {
      setCreating(false)
    }
  }

  const handleRevokeInvite = async (inviteId) => {
    try {
      await api.revokeInvite(inviteId)
      loadDetail()
    } catch (e) {
      setError(e.message)
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleCreateAccount = async () => {
    const name = newAccountName.trim()
    if (!name) return
    setCreatingAccount(true)
    try {
      await api.createAccount({ name })
      setNewAccountName('')
      await refresh()
      loadDetail()
    } catch (e) {
      setError(e.message)
    } finally {
      setCreatingAccount(false)
    }
  }

  return (
    <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <Box
        style={{
          padding: '28px 24px 20px',
          background: 'linear-gradient(135deg, #009688, #4CAF50)',
          flexShrink: 0,
        }}
      >
        <Group align="center" gap={10}>
          <ActionIcon
            variant="transparent"
            onClick={() => navigate('/home')}
            style={{ color: 'rgba(255,255,255,0.85)' }}
          >
            ←
          </ActionIcon>
          <Text fw={700} c="white" size="lg">Account Settings</Text>
        </Group>
        {activeAccount && (
          <Text c="white" style={{ opacity: 0.8, fontSize: 13, marginTop: 4, marginLeft: 34 }}>
            {activeAccount.name}
          </Text>
        )}
      </Box>

      {/* Scrollable body */}
      <Box style={{ flex: 1, overflowY: 'auto', padding: '0 20px 32px' }}>

        {inviteAccepted && (
          <Box style={{ marginTop: 16, padding: '10px 14px', background: '#0d2018', border: '1px solid #166534', borderRadius: 10 }}>
            <Text style={{ fontSize: 13, color: '#4ade80' }}>✓ You've joined the account successfully!</Text>
          </Box>
        )}
        {inviteError && (
          <Box style={{ marginTop: 16, padding: '10px 14px', background: '#1c0a0a', border: '1px solid #7f1d1d', borderRadius: 10 }}>
            <Text style={{ fontSize: 13, color: DANGER }}>Invite link is invalid or has expired.</Text>
          </Box>
        )}

        {/* Account switcher */}
        <AccountSwitcherSection
          accounts={accounts}
          activeAccount={activeAccount}
          switchAccount={switchAccount}
        />

        {/* Members */}
        <SectionHeader>Members</SectionHeader>
        {loading ? (
          <Text style={{ fontSize: 13, color: MUTED }}>Loading…</Text>
        ) : accountDetail ? (
          <Card>
            {accountDetail.members.length === 0 && (
              <Text style={{ fontSize: 13, color: MUTED }}>No members found.</Text>
            )}
            {accountDetail.members.map((m, i) => (
              <MemberRow
                key={m.userId}
                member={m}
                isPrimary={m.userId === accountDetail.account.primaryOwner}
              />
            ))}
          </Card>
        ) : null}

        {/* Pending invites */}
        {accountDetail?.pendingInvites?.length > 0 && (
          <>
            <SectionHeader>Pending Invites</SectionHeader>
            <Card>
              {accountDetail.pendingInvites.map((inv) => (
                <InviteRow key={inv.inviteId} invite={inv} onRevoke={handleRevokeInvite} />
              ))}
            </Card>
          </>
        )}

        {/* Create invite */}
        <SectionHeader>Invite Someone</SectionHeader>
        <Card>
          <Text style={{ fontSize: 12, color: MUTED, marginBottom: 12 }}>
            Generate a link to share. Anyone with the link can join this account for 7 days.
          </Text>
          <Group gap={8} align="flex-end">
            <TextInput
              placeholder="Label (optional)"
              value={inviteLabel}
              onChange={(e) => setInviteLabel(e.target.value)}
              style={{ flex: 1 }}
              styles={{
                input: {
                  background: '#111118',
                  border: `1px solid ${BORDER}`,
                  color: '#e2e8f0',
                  borderRadius: 8,
                  fontSize: 13,
                },
              }}
            />
            <Button
              size="sm"
              loading={creating}
              onClick={handleCreateInvite}
              style={{ background: TEAL, borderRadius: 8 }}
            >
              Generate
            </Button>
          </Group>

          {inviteUrl && (
            <Box
              style={{
                marginTop: 12,
                padding: '10px 12px',
                background: '#111118',
                borderRadius: 8,
                border: `1px solid ${TEAL}44`,
              }}
            >
              <Text style={{ fontSize: 11, color: MUTED, marginBottom: 4 }}>Share this link:</Text>
              <Group justify="space-between" align="center" gap={8}>
                <Text
                  style={{
                    fontSize: 12,
                    color: '#94a3b8',
                    flex: 1,
                    wordBreak: 'break-all',
                    fontFamily: 'monospace',
                  }}
                >
                  {inviteUrl}
                </Text>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={handleCopy}
                  style={{ borderColor: TEAL, color: TEAL, flexShrink: 0 }}
                >
                  {copied ? '✓ Copied' : 'Copy'}
                </Button>
              </Group>
            </Box>
          )}
        </Card>

        {/* Create new account */}
        <SectionHeader>Create New Account</SectionHeader>
        <Card>
          <Text style={{ fontSize: 12, color: MUTED, marginBottom: 12 }}>
            Create a separate account (e.g. for a business or household).
          </Text>
          <Group gap={8} align="flex-end">
            <TextInput
              placeholder="Account name"
              value={newAccountName}
              onChange={(e) => setNewAccountName(e.target.value)}
              style={{ flex: 1 }}
              styles={{
                input: {
                  background: '#111118',
                  border: `1px solid ${BORDER}`,
                  color: '#e2e8f0',
                  borderRadius: 8,
                  fontSize: 13,
                },
              }}
            />
            <Button
              size="sm"
              loading={creatingAccount}
              onClick={handleCreateAccount}
              disabled={!newAccountName.trim()}
              style={{ background: TEAL, borderRadius: 8 }}
            >
              Create
            </Button>
          </Group>
        </Card>

        {error && (
          <Text style={{ fontSize: 12, color: DANGER, marginTop: 16 }}>{error}</Text>
        )}

        <SectionHeader>Session</SectionHeader>
        <Button
          fullWidth
          variant="outline"
          onClick={signOut}
          style={{ borderColor: DANGER, color: DANGER, borderRadius: 10, fontSize: 13 }}
        >
          Sign out
        </Button>
      </Box>
    </Box>
  )
}
