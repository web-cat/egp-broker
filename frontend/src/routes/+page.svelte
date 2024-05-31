<script>
	import { onMount } from 'svelte';
	import 'bootstrap/dist/css/bootstrap.min.css';
	import '/src/styles/global.css';
	import { user, token, isLoading } from '../stores';
	import { goto } from '$app/navigation';

	var mounted = false;
	onMount(async () => {
		mounted = true;
		const storedUser = localStorage.getItem('user');
		const storedToken = localStorage.getItem('token');
		if (storedUser && storedToken) {
			user.set(JSON.parse(storedUser));
			token.set(JSON.parse(storedToken));
			if ($user?.role === 'instructor') {
				goto('/instructor/home');
			} else {
				goto('/student/home');
			}
		} else {
			goto('/logout');
			return;
		}
	});
</script>

<main
	style="height: 100vh; margin-top: 20vh"
	class="container d-flex flex-column h-100 align-items-center justify-content-center"
>
	<h1>Welcome to Pass management</h1>
	<p>Visit <a href="/login">Login</a> to get started</p>

	<a class="btn btn-primary" href="/login">Login</a>
</main>
