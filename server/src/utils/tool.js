const axios = require("axios");
const OAuth = require('oauth-signature');
const { URLSearchParams } = require('url');

const LTI_CONSUMER_KEY = process.env.LTI_CONSUMER_KEY;
const LTI_SHARED_SECRET = process.env.LTI_SHARED_SECRET;
const LTI_LAUNCH_URL = process.env.LTI_LAUNCH_URL;
const TOOL_HOST = process.env.TOOL_HOST;

async function launchOpenDSA(userData, resourceLinkId) {
    const headers = {
        "Referer": TOOL_HOST,
        "Content-Type": "application/x-www-form-urlencoded",
    };

    // Parameters for the LTI 1.1 launch, including standard OAuth parameters
    // These will be used to generate the signature
    const params = {
        oauth_consumer_key: LTI_CONSUMER_KEY,
        oauth_signature_method: "HMAC-SHA1",
        oauth_timestamp: Math.floor(Date.now() / 1000),
        oauth_nonce: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
        oauth_version: "1.0",
        
        // LTI params
        lti_message_type: "basic-lti-launch-request",
        lti_version: "LTI-1p0",
        resource_link_id: resourceLinkId, 
        user_id: userData.userId,
        //roles: userData.roles,
        roles: "Instructor",
        lis_person_contact_primary_email: userData.userEmail,
        lis_person_name_given: userData.givenName,
        lis_person_name_family: userData.familyName,
        lis_person_name_full: userData.fullName,

        // OpenDSA specific custom parameters
        custom_book_path: "vt/cs2114/summer-i-2025/LTI_TEST",
        custom_inst_book_id: "548",
        custom_inst_chapter_id: "5963",
        custom_inst_chapter_module_id: "36483",
        custom_inst_module_id: "58",
        custom_module_file_name: "BinaryTreeIntro",
        custom_module_title: "11.01 Binary Trees Chapter Introduction",
        //custom_grade_passback_url: `${TOOL_HOST}/opendsa-grade-passback`,

        // LIS Outcome Service parameters (for grade passback from OpenDSA to your tool)
        //lis_outcome_service_url: `${TOOL_HOST}/opendsa-grade-passback`,
        //lis_result_sourcedid: `course_${userData.courseContextId}_resource_${resourceLinkId}_user_${userData.userId}`,
        
        // Other LTI parameters
        //custom_course_homepage_url: 'test', // Customize this
        //launch_presentation_return_url: 'test', // Customize this
        //tool_consumer_info_product_family_code: 'um', // Example, adjust if OpenDSA expects something specific
    };

    console.log("launchOpenDSA: Function started. Parameters for signature generation:", params);

    // Generate the OAuth signature using oauth-signature
    const signature = OAuth.generate(
        'POST',
        LTI_LAUNCH_URL,
        params,
        LTI_SHARED_SECRET,
        null
    );

    // Add the generated signature to the parameters
    params.oauth_signature = decodeURIComponent(signature);

    console.log("launchOpenDSA: LTI 1.1 Launch Parameters being sent to OpenDSA (with signature):", params);

    try {
        console.log('launchOpenDSA: Attempting to POST to OPEN_DSA_LTI_LAUNCH_URL:', LTI_LAUNCH_URL);
        // Send the POST request to OpenDSA
        // URLSearchParams is used to correctly format the data as application/x-www-form-urlencoded
        const response = await axios.post(LTI_LAUNCH_URL, new URLSearchParams(params).toString(), { headers });

        console.log('launchOpenDSA: LTI Launch Successful to OpenDSA. Status:', response.status);
        // OpenDSA's response.data will be the HTML content
        return response.data;

    } catch (error) {
        console.error('launchOpenDSA: LTI Launch Failed with detailed error:', error);
        if (error.response) {
            console.error('launchOpenDSA: OpenDSA Error Response Status:', error.response.status);
            console.error('launchOpenDSA: OpenDSA Error Response Headers:', error.response.headers);
            console.error('launchOpenDSA: OpenDSA Error Response Body:', error.response.data);
            throw new Error(`OpenDSA LTI Launch failed: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
        } else if (error.request) {
            console.error('launchOpenDSA: No response received from OpenDSA:', error.request);
            throw new Error('No response received from OpenDSA.');
        } else {
            console.error('launchOpenDSA: Error during request setup for OpenDSA LTI Launch:', error.message);
            throw new Error(`Error setting up OpenDSA LTI Launch request: ${error.message}`);
        }
    }
}

module.exports = { launchOpenDSA };