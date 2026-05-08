import { defineEventHandler, getQuery, createError } from 'h3'
import prisma from '../../../lib/prisma'
import { getServerSiteUrl } from '../../utils/site'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const openidConfigurationUrl = query.openid_configuration as string
  const registrationToken = query.registration_token as string

  if (!openidConfigurationUrl || !registrationToken) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing openid_configuration or registration_token'
    })
  }

  try {
    // 1. Fetch Platform Configuration
    const platformConfig = await $fetch<any>(openidConfigurationUrl)
    const issuer = platformConfig.issuer
    const registrationEndpoint = platformConfig.registration_endpoint

    if (!registrationEndpoint) {
      throw new Error('Platform does not provide a registration_endpoint')
    }

    // 2. Prepare Tool Configuration for Registration
    const siteUrl = getServerSiteUrl(event)
    const toolConfig = {
      application_type: 'web',
      response_types: ['id_token'],
      grant_types: ['implicit', 'client_credentials'],
      initiate_login_uri: `${siteUrl}/api/lti13/login`,
      redirect_uris: [`${siteUrl}/api/lti13/launch`],
      client_name: 'EGP Broker',
      jwks_uri: `${siteUrl}/api/lti13/jwks`,
      logo_uri: `${siteUrl}/favicon.ico`,
      token_endpoint_auth_method: 'private_key_jwt',
      'https://purl.imsglobal.org/spec/lti-tool-configuration': {
        domain: siteUrl.replace(/^https?:\/\//, ''),
        target_link_uri: `${siteUrl}/api/lti13/launch`,
        custom_fields: {
          user_id: '$User.id',
          course_id: '$CourseSection.sourcedId',
          canvas_user_id: '$Canvas.user.id',
          canvas_course_id: '$Canvas.course.id',
          canvas_assignment_id: '$Canvas.assignment.id'
        },
        claims: [
          'iss',
          'sub',
          'aud',
          'given_name',
          'family_name',
          'email',
          'https://purl.imsglobal.org/spec/lti/claim/deployment_id',
          'https://purl.imsglobal.org/spec/lti/claim/message_type',
          'https://purl.imsglobal.org/spec/lti/claim/version',
          'https://purl.imsglobal.org/spec/lti/claim/roles',
          'https://purl.imsglobal.org/spec/lti/claim/context',
          'https://purl.imsglobal.org/spec/lti/claim/resource_link',
          'https://purl.imsglobal.org/spec/lti-ags/claim/endpoint',
          'https://purl.imsglobal.org/spec/lti-nrps/claim/endpoint'
        ]
      }
    }

    // 3. Register Tool with Platform
    const registrationResponse = await $fetch<any>(registrationEndpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${registrationToken}`,
        'Content-Type': 'application/json'
      },
      body: toolConfig
    })

    const clientId = registrationResponse.client_id
    const deploymentId =
      registrationResponse['https://purl.imsglobal.org/spec/lti-tool-configuration']?.deployment_id

    if (!clientId) {
      throw new Error('Registration failed: No client_id returned from platform')
    }

    // 4. Upsert Platform and Deployment in DB
    const platform = await prisma.ltiPlatform.upsert({
      where: { issuer },
      update: {
        clientId,
        authEndpoint: platformConfig.authorization_endpoint,
        tokenEndpoint: platformConfig.token_endpoint,
        jwksEndpoint: platformConfig.jwks_uri,
        name: platformConfig.issuer // Default name to issuer
      },
      create: {
        issuer,
        clientId,
        authEndpoint: platformConfig.authorization_endpoint,
        tokenEndpoint: platformConfig.token_endpoint,
        jwksEndpoint: platformConfig.jwks_uri,
        name: platformConfig.issuer
      }
    })

    if (deploymentId) {
      await prisma.ltiDeployment.upsert({
        where: {
          platformId_deploymentId: {
            platformId: platform.id,
            deploymentId
          }
        },
        update: {},
        create: {
          platformId: platform.id,
          deploymentId
        }
      })
    }

    return {
      status: 'success',
      clientId,
      deploymentId,
      message: `Successfully registered with ${issuer}`
    }
  } catch (error: any) {
    console.error('LTI Dynamic Registration Error:', error)
    throw createError({
      statusCode: 500,
      statusMessage: `Dynamic registration failed: ${error.message}`
    })
  }
})
