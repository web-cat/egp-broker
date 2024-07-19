<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { user, token } from '../../stores'; // Importing stores for user and token

	onMount(() => {
		// Clear local storage items
		localStorage.removeItem('user');
		localStorage.removeItem('token');
		localStorage.removeItem('course');

		// Reset Svelte stores
		user.set(null);
		token.set(null);

		// Redirect to home page
		window.location.href = '/login';
	});
</script>

<main>
	Logging out...
</main>
