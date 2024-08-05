import { json, redirect } from '@sveltejs/kit';
import axios from 'axios';

export async function load({ url }) {
    const code = url.searchParams.get('code');
    if (!code) throw new Error('No code provided');

    try {
        // Exchange authorization code for token
        const tokenResponse = await axios.post('http://192.168.1.68:3091/login/oauth2/token', {
            grant_type: 'authorization_code',
            client_id: '10000000000015',
            client_secret: 'h2YnSFCLvNLBjpIS34bqTs045Hh1VoF1R8rhHO6YEVlH0kbket4djKV99Jd8MC9z',
            redirect_uri: 'http://localhost:5173/lti/launch',
            code
        });
        const tokenData = tokenResponse.data;
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
