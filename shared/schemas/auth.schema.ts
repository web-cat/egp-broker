import { z } from 'zod'

export const LtiLaunchSchema = z.object({
  id_token: z.string().min(1),
  state: z.string().uuid()
})

export type LtiLaunchInput = z.infer<typeof LtiLaunchSchema>

export const LtiLoginSchema = z.object({
  iss: z.string().min(1),
  login_hint: z.string().min(1),
  target_link_uri: z.string().min(1),
  lti_message_hint: z.string().optional()
})

export type LtiLoginInput = z.infer<typeof LtiLoginSchema>
