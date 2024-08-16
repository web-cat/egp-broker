import { json, redirect } from '@sveltejs/kit';
import axios from 'axios';

export async function load({ url }) {
    console.log("LTI launch!");

    // Log all search parameters
    for (const [key, value] of url.searchParams.entries()) {
        console.log(`Param: ${key}, Value: ${value}`);
    }

    // Log the full URL for reference
    console.log('Full URL:', url.toString());

    const code = url.searchParams.get('code');
    const id_token = url.searchParams.get('id_token');

    if (!code && !id_token) {
        throw new Error('No code or id_token provided');
    }

    try {
        let tokenData;

        if (code) {
            // Handle the case where "code" is provided
            const tokenResponse = await axios.post('http://192.168.1.68:3091/login/oauth2/token', {
                grant_type: 'authorization_code',
                client_id: '10000000000015',
                client_secret: 'h2YnSFCLvNLBjpIS34bqTs045Hh1VoF1R8rhHO6YEVlH0kbket4djKV99Jd8MC9z',
                redirect_uri: 'http://localhost:3000/lti/launch',
                code
            });
            tokenData = tokenResponse.data;
        } else if (id_token) {
            // Handle the case where "id_token" is provided
            tokenData = { id_token };
            console.log('ID Token received:', id_token);
            // You might want to verify the id_token or process it according to your needs
        }

        console.log('Token data:', tokenData);

        // Return the tokenData object directly
        return { tokenData };
    } catch (error) {
        console.error('Error during token exchange:', error);

        // Return an error object with the error message and status code
        return {
            status: 500,
            error: error.message
        };
    }
}
