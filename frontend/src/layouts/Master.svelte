<script>
	// Import your header and footer components
	import Header from './Header.svelte';
	import Footer from './Footer.svelte';
	import { onMount } from 'svelte';
	import 'bootstrap/dist/css/bootstrap.min.css';
	import '/src/styles/global.css';
	import { user, token, isLoading, course } from '../stores';
	import { goto } from '$app/navigation';

	var mounted = false;
	onMount(async () => {
		mounted = true;
		const storedUser = localStorage.getItem('user');
		const storedToken = localStorage.getItem('token');
		const storedCourse = localStorage.getItem('course');
		if (storedUser && storedToken) {
			user.set(JSON.parse(storedUser));
			token.set(JSON.parse(storedToken));
			course.set(JSON.parse(storedCourse));
		} else {
			// goto('/logout');
			return;
		}
	});
</script>

{#if mounted}
	{#if $user}
		<div class="site-container">
			<Header />

			<div class="content">
				<!-- Your page content goes here -->
				<slot />
			</div>

			<Footer />
			{#if $isLoading}
				<div class="loading-overlay"></div>
				<div class="loading-box">
					<p>Loading...</p>
					<p class="text-dark text-center m-0">Loading</p>
				</div>
			{/if}
		</div>
	{/if}
{/if}

<style>
	.site-container {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
	}

	.content {
		padding: 0 2rem;
		flex: 1;
		/* Ensure content takes up the available space, pushing the footer down */
	}
</style>
