/**
 * @openapi
 * /api/auth/reset-password:
 *   post:
 *     summary: Reset user password
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, password, confirmPassword]
 *             properties:
 *               token:
 *                 type: string
 *                 description: Password reset token
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 description: New password
 *               confirmPassword:
 *                 type: string
 *                 description: Password confirmation
 *     responses:
 *       200:
 *         description: Password reset successfully
 *       400:
 *         description: Invalid token or validation error
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  if (!config.public.enablePasswordLogin) {
    throw createError({
      statusCode: 403,
      message: 'Email/Password login is currently disabled.'
    })
  }

  const t = await useTranslation(event)
  const { token, password } = await validateBody(event, createResetPasswordSchema(t))

  // Use auth service for business logic
  const result = await resetUserPassword(token, password)

  return createApiResponse(result, HTTP_STATUS.OK)
})
