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
