// auth.d.ts
declare module '#auth-utils' {
  interface User extends PublicUser {
    currentCourseId?: string | null
  }

  interface LtiContext {
    platformId?: string
    issuer?: string
    deploymentId?: string
    state?: string
    nonce?: string
    targetLinkUri?: string
    context?: {
      id: string
      title?: string
      label?: string
    }
    resourceLink?: {
      id: string
      title?: string
    }
  }

  interface UserSession {
    user: User
    loggedInAt: Date
    lti?: LtiContext
    authMethod?: 'local' | 'cas' | 'lti'
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface SecureSessionData {
    // Add your own fields if needed
  }
}

export {}
