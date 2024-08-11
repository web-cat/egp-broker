<script>
	import { onMount } from 'svelte';
	import 'bootstrap/dist/css/bootstrap.min.css';
	import '/src/styles/global.css';
	import { user, token, isLoading } from '../stores';
	import { goto } from '$app/navigation';
	import AuthMaster from '../layouts/AuthMaster.svelte';

	let email = '';
	let password = '';
	let userEmail = '';
	let userPassword = '';
	let error = '';
	let errorMessage = '';

	const handleUserLogin = async (e) => {
		e.preventDefault();
		isLoading.set(true);

		try {
			const response = await fetch('http://localhost:3001/api/user/login', {
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
			const response = await fetch('http://localhost:3001/api/login', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ email: userEmail, password: userPassword }),
			});
			const data = await response.json();

			if (response.ok) {
				user.set(data.user);
				token.set(data.token);
				localStorage.setItem('user', JSON.stringify(data.user));
				localStorage.setItem('token', JSON.stringify(data.token));
				goto('/home');
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
<!-- 
<main
		style="height: 100vh; margin-top: 20vh"
		class="container d-flex flex-column h-100 align-items-center justify-content-center"
>
	<h1>Welcome to Pass Management</h1>

	<h2 class="mt-5">Login</h2>
	<form on:submit={handleAdminLogin} class="w-100" style="max-width: 500px;">
		<div class="mb-3">
			<label for="admin-email" class="form-label">Email</label>
			<input type="email" id="admin-email" bind:value={userEmail} class="form-control" required />
		</div>
		<div class="mb-3">
			<label for="admin-password" class="form-label">Password</label>
			<input type="password" id="admin-password" bind:value={userPassword} class="form-control" required />
		</div>
		{#if error}
			<div class="alert alert-danger" role="alert">{error}</div>
		{/if}
		<button type="submit" class="btn btn-primary">Login</button>
	</form>

	<p class="mt-5">Visit <a href="/login">Login</a> to get started</p>
	<a class="btn btn-primary mb-3" href="/login-canvas">Login with Canvas</a>
	<a class="btn btn-primary" href="/login">Login with Admin</a>
	
</main>
 -->

 <AuthMaster>
	<div class="">
		<div class="row ">
			<div class="col-md-4 h-full bg-signin text-center text-white p-5 gap-2">
				<h3>EGP-BROKER</h3>
				<p></p>
			</div>
			<div class="col-md-8 h-full d-flex flex-column justify-content-center align-items-center">
				<div class="text-center">
					<h5>Login to EGP-BROKER</h5>
					<p class="text-muted"></p>
				</div>
				<form on:submit={handleAdminLogin} class="form-group">
					<label for="email">Email:</label>
					<input class="form-control" id="email" type="email" bind:value={userEmail} required />

					<label for="password">Password:</label>
					<input
						class="form-control"
						id="password"
						type="password"
						bind:value={userPassword}
						required
					/>

					<button class="btn btn-primary mt-2" type="submit">Login</button>

				</form>
				<!-- <button on:click={redirectToCanvasAuth}>Login with canvas</button> -->

				<p class="mt-5">Visit <a href="/login">Login</a> to get started</p>
				<a class="btn btn-primary mb-3" href="/login-canvas">Login with Canvas</a>
				<a class="btn btn-primary" href="/login">Login As Admin</a>


				{#if errorMessage}
					<p style="color: red;">{errorMessage}</p>
				{/if}
			</div>
		</div>
	</div>
</AuthMaster>

<style>
	.bg-signin {
		background-color: navy;
		background-size: cover;
		display: flex;
		justify-content: center;
		align-items: center;
		flex-direction: column;
	}

	@media (max-width: 768px) {
		.bg-signin{
			display: none;
		}
	}
	@media only screen and (max-width: 600px) {

	}
</style>
