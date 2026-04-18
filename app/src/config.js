import { Amplify } from 'aws-amplify'

const redirectUri = import.meta.env.VITE_REDIRECT_URI || window.location.origin

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_USER_POOL_ID,
      userPoolClientId: import.meta.env.VITE_USER_POOL_CLIENT_ID,
      loginWith: {
        oauth: {
          domain: import.meta.env.VITE_COGNITO_DOMAIN,
          scopes: ['openid', 'email', 'profile'],
          redirectSignIn: [redirectUri],
          redirectSignOut: [redirectUri],
          responseType: 'code',
        },
      },
    },
  },
})
