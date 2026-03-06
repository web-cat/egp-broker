import { defineEventHandler } from 'h3'

export default defineEventHandler((event) => {
    // Use the environment variable or construct from the request if missing
    const siteUrl = process.env.NUXT_SITE_URL || `https://${event.node.req.headers.host}`

    // Standard Canvas Dynamic Registration JSON format
    const config = {
        title: 'EGP Broker',
        description: 'An application to support equitable grading practices',
        oidc_initiation_url: `${siteUrl}/api/lti13/login`,
        target_link_uri: `${siteUrl}/api/lti13/launch`,
        extensions: [
            {
                domain: siteUrl.replace(/^https?:\/\//, ''),
                tool_id: 'egp-broker',
                platform: 'canvas.instructure.com',
                settings: {
                    text: 'EGP Broker',
                    privacy_level: 'public',
                    icon_url: `${siteUrl}/favicon.ico`,
                    placements: [
                        {
                            text: 'EGP Broker',
                            placement: 'course_navigation',
                            message_type: 'LtiResourceLinkRequest',
                            target_link_uri: `${siteUrl}/api/lti13/launch`
                        },
                        {
                            text: 'Tools via EGP Broker',
                            placement: 'assignment_selection',
                            message_type: 'LtiDeepLinkingRequest',
                            target_link_uri: `${siteUrl}/api/lti13/launch`
                        }
                    ]
                }
            }
        ],
        public_jwk_url: `${siteUrl}/api/lti13/jwks`,
        custom_fields: {
            user_id: '$User.id',
            course_id: '$CourseSection.sourcedId',
            canvas_user_id: '$Canvas.user.id',
            canvas_course_id: '$Canvas.course.id'
        },
        scopes: [
            'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem',
            'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly',
            'https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly',
            'https://purl.imsglobal.org/spec/lti-ags/scope/score',
            'https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly'
        ]
    }

    // Set standard JSON content type
    event.node.res.setHeader('Content-Type', 'application/json')

    return config
})
