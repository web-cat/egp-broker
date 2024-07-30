import { json, redirect } from '@sveltejs/kit';
import axios from 'axios';

export async function load({ url }) {
    const code = url.searchParams.get('code');
    if (!code) throw new Error('No code provided');

    try {
        // Exchange authorization code for token
        const tokenResponse = await axios.post('http://192.168.1.168:3091/login/oauth2/token', {
            grant_type: 'authorization_code',
            client_id: '10000000000014',
            client_secret: 'nCLxlZQNWc7AdPLZOzOkwiOXwHePUNY8TPZrOzEhmTXuppt7BCk0vpBCkoTTbfYn',
            redirect_uri: 'http://localhost:5173/oauth2response',
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
