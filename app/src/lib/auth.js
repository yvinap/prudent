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

import {
  signInWithRedirect,
  signOut as amplifySignOut,
  fetchAuthSession,
  getCurrentUser,
} from 'aws-amplify/auth'

export const signIn = async () => {
  try {
    await signInWithRedirect({ provider: 'Google' })
  } catch (err) {
    // If the user is already signed in (e.g. returning from OAuth redirect
    // while Amplify has already restored the session), just ignore it.
    if (err?.name === 'UserAlreadyAuthenticatedException') return
    throw err
  }
}

export const signOut = () => amplifySignOut()

export const getUser = () => getCurrentUser()

export const getIdToken = async () => {
  const { tokens } = await fetchAuthSession()
  return tokens?.idToken?.toString() ?? null
}
