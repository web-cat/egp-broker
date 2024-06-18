/** @type {import('@sveltejs/kit').Handle} */
import { redirect } from '@sveltejs/kit';

export async function handle({ event, resolve }) {
	// List of paths that don't require authentication
	const publicPaths = ['/api/authenticate', '/signin', '/signup','/auth/callback'];

	// Attempt to parse the cookies, defaulting to null if not found or if parsing fails
	let token = null;
	let user = null;

	try {
		token = event.cookies.get('token') ? JSON.parse(event.cookies.get('token')) : null;
		user = event.cookies.get('user') ? JSON.parse(event.cookies.get('user')) : null;
	} catch (error) {
		console.error('Error parsing cookies:', error);
		// Consider how you want to handle cookie parsing errors. Redirect, error page, etc.?
		// For example, redirecting to an error page:
		return redirect(303, '/error-page');
	}

	// Proceed with redirect logic outside of the try-catch block
	if ((token == null || token === '') && (user == null || user === '') && !publicPaths.includes(event.url.pathname)) {
		// return redirect(303, '/logout');
	}

	if (event.url.pathname.endsWith('/logout')) {
		event.cookies.delete('token', {
			path: '/',
			httpOnly: true,
			secure: true,
			sameSite: 'strict',
		});
		event.cookies.delete('user', {
			path: '/',
			httpOnly: true,
			secure: true,
			sameSite: 'strict',
		});
		return redirect(303, '/login');
	}

	// If no redirects are necessary, proceed with the request
	return resolve(event);
}
