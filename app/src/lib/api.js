import { getIdToken } from './auth'

// Strip any trailing slash so paths like '/me' don't produce double slashes
const BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

const ACTIVE_ACCOUNT_KEY = 'prudent_active_account_id'

export function getActiveAccountId() {
  return localStorage.getItem(ACTIVE_ACCOUNT_KEY)
}

export function setActiveAccountId(id) {
  if (id) {
    localStorage.setItem(ACTIVE_ACCOUNT_KEY, id)
  } else {
    localStorage.removeItem(ACTIVE_ACCOUNT_KEY)
  }
}

async function request(method, path, body) {
  const token = await getIdToken()
  const headers = {
    Authorization: token,
    'Content-Type': 'application/json',
  }
  const activeAccountId = getActiveAccountId()
  if (activeAccountId) {
    headers['X-Account-Id'] = activeAccountId
  }
  const opts = { method, headers }
  if (body !== undefined) opts.body = JSON.stringify(body)
  const res = await fetch(BASE_URL + path, opts)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export const api = {
  // User
  getMe: () => request('GET', '/me'),

  // Things
  listThings: () => request('GET', '/things'),
  createThing: (data) => request('POST', '/things', data),
  updateThing: (id, data) => request('PUT', `/things/${id}`, data),

  // Categories
  listCategories: () => request('GET', '/categories'),
  createCategory: (data) => request('POST', '/categories', data),
  updateCategory: (id, data) => request('PUT', `/categories/${id}`, data),

  // Tags
  listTags: () => request('GET', '/tags'),
  createTag: (data) => request('POST', '/tags', data),
  updateTag: (id, data) => request('PUT', `/tags/${id}`, data),

  // Budgets
  listBudgets: () => request('GET', '/budgets'),
  createBudget: (data) => request('POST', '/budgets', data),
  updateBudget: (id, data) => request('PUT', `/budgets/${id}`, data),

  // Transactions
  listTransactions: (params = {}) =>
    request('GET', '/transactions?' + new URLSearchParams(params)),
  createTransaction: (data) => request('POST', '/transactions', data),
  updateTransaction: (id, data) => request('PUT', `/transactions/${id}`, data),
  deleteTransaction: (id, data) => request('DELETE', `/transactions/${id}`, data),

  // Receipts — returns { receipt, uploadUrl }
  initiateReceiptUpload: (contentType) =>
    request('POST', '/receipts', { contentType }),

  // Account management
  getAccount: () => request('GET', '/account'),
  createAccount: (data) => request('POST', '/accounts', data),

  // Invites
  createInvite: (data) => request('POST', '/invites', data),
  revokeInvite: (inviteId) => request('DELETE', `/invites/${inviteId}`),
  acceptInvite: (token) => request('POST', '/invites/accept', { token }),
}

/** Upload a file directly to S3 via a presigned PUT URL. */
export async function uploadToPresignedUrl(url, file) {
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  })
  if (!res.ok) throw new Error(`Upload failed: HTTP ${res.status}`)
}
