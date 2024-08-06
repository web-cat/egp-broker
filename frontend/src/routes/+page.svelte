<script>
	import { onMount } from 'svelte';
	import 'bootstrap/dist/css/bootstrap.min.css';
	import '/src/styles/global.css';
	import { user, token, isLoading } from '../stores';
	import { goto } from '$app/navigation';

	let email = '';
	let password = '';
	let adminEmail = '';
	let adminPassword = '';
	let error = '';

	const handleUserLogin = async (e) => {
		e.preventDefault();
		isLoading.set(true);

		try {
			const response = await fetch('http://localhost:3100/api/user/login', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ email, password }),
			});
			const data = await response.json();

			if (response.ok) {
				user.set(data.user);
				token.set(data.token);
				localStorage.setItem('user', JSON.stringify(data.user));
				localStorage.setItem('token', JSON.stringify(data.token));
				if ($user?.role === 'instructor') {
					goto('/instructor/home');
				} else {
					goto('/student/home');
				}
			} else {
				error = data.error || 'Login failed.';
			}
		} catch (err) {
			console.error(err);
			error = 'An error occurred during login.';
		} finally {
			isLoading.set(false);
		}
	};

	const handleAdminLogin = async (e) => {
		e.preventDefault();
		isLoading.set(true);

		try {
			const response = await fetch('http://localhost:3100/api/admin/login', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ email: adminEmail, password: adminPassword }),
			});
			const data = await response.json();

			if (response.ok) {
				user.set(data.user);
				token.set(data.token);
				localStorage.setItem('user', JSON.stringify(data.user));
				localStorage.setItem('token', JSON.stringify(data.token));
				goto('/admin');
			} else {
				error = data.error || 'Login failed.';
			}
		} catch (err) {
			console.error(err);
			error = 'An error occurred during login.';
		} finally {
			isLoading.set(false);
		}
	};
</script>

<main
		style="height: 100vh; margin-top: 20vh"
		class="container d-flex flex-column h-100 align-items-center justify-content-center"
>
	<h1>Welcome to Pass Management</h1>


	<!-- New Admin Login -->
	<h2 class="mt-5">Admin Login</h2>
	<form on:submit={handleAdminLogin} class="w-100" style="max-width: 500px;">
		<div class="mb-3">
			<label for="admin-email" class="form-label">Email</label>
			<input type="email" id="admin-email" bind:value={adminEmail} class="form-control" required />
		</div>
		<div class="mb-3">
			<label for="admin-password" class="form-label">Password</label>
			<input type="password" id="admin-password" bind:value={adminPassword} class="form-control" required />
		</div>
		{#if error}
			<div class="alert alert-danger" role="alert">{error}</div>
		{/if}
		<button type="submit" class="btn btn-primary">Login as Admin</button>
	</form>

	<!-- Links -->
	<p class="mt-5">Visit <a href="/login">Login</a> to get started</p>
	<a class="btn btn-primary mb-3" href="/login">Login</a>
	<a class="btn btn-primary" href="/login-canvas">Login with Canvas</a>
</main>
