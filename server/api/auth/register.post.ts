/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, confirmPassword, firstName, lastName]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *               confirmPassword:
 *                 type: string
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               termsAccepted:
 *                 type: boolean
 *               termsOfSaleAccepted:
 *                 type: boolean
 *               privacyAccepted:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Validation error
 *       409:
 *         description: User already exists
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  if (!config.public.enablePasswordLogin) {
    throw createError({
      statusCode: 403,
      message: 'Email/Password registration is currently disabled.'
    })
  }

  const t = await useTranslation(event)
  const userData = await validateBody(event, createRegisterSchema(t))

  // Use auth service for business logic
  const result = await registerUser(userData, event)

  return createCreatedResponse(result)
})
