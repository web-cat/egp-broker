<script>
	import 'bootstrap/dist/css/bootstrap.min.css';
	import '/src/styles/global.css';
	import { writable } from 'svelte/store';
	import { goto } from '$app/navigation';
	import axios from 'axios';
	const token = writable(null);
	const user = writable(null);

	let email = '';
	let password = '';
	let errorMessage = '';

	const login = async () => {
		try {
			const response = await axios.post('https://egp-broker.cs.vt.edu/egp-broker-service/api/login', { email, password });
			
			// Store user and token in local storage
			localStorage.setItem('user', JSON.stringify(response.data.user));
			localStorage.setItem('token', JSON.stringify(response.data.token));

			// Set user and token in the store
			user.set(response.data.user);
			token.set(response.data.token);
			
			// Check the user's role and navigate accordingly
			const { role } = response.data.user;
			if (role === 'admin') {
				goto('/admin/dashboard');
			} else {
				goto('/home');
			}
		} catch (error) {
			errorMessage = error.response?.data?.error || 'Login failed';
		}
	};
</script>

<div class="d-flex vh-100">
	<div class="flex-first d-none d-md-flex">
		<p>EGP Broker</p>
	</div>
	<main class="flex-second container d-flex flex-column align-items-center justify-content-center">
		<div class="">
			<h1 class="mb-4">Login to EGP-BROKER</h1>
			<form class="w-100" on:submit|preventDefault={login}>
				<div class="form-group mb-3">
					<label for="email">Email:</label>
					<input class="form-control" id="email" type="email" bind:value={email} required />
				</div>
				<div class="form-group mb-4">
					<label for="password">Password:</label>
					<input class="form-control" id="password" type="password" bind:value={password} required />
				</div>
					<button class="btn block btn-primary btn-block mb-3" type="submit">Login</button>
			</form>
			<a class="btn block btn-outline-primary btn-block" href="/login-canvas">Login with Canvas</a>

			{#if errorMessage}
				<p class="text-danger mt-3">{errorMessage}</p>
			{/if}
		</div>
	</main>
</div>

<style>
	.flex-first {
		display: flex;
		width: 400px;
		align-items: center;
		justify-content: center;
		color: white;
		text-align: center;
		background-color: navy;
	}
	.flex-first p {
		font-size: 32px;
		letter-spacing: 2px;
		font-weight: bold;
		margin: 0;
	}


	.flex-second {
		flex: 1;
		display: flex;
		justify-content: center;
		align-items: center;
		background-color: #f8f9fa;
		padding: 20px;
	}

	form {
		width: 100%;
	}

	h1, h5 {
		color: #343a40;
	}



	@media (max-width: 767.98px) {
		.flex-first {
			display: none;
		}
		.flex-second {
			width: 100%;
		}
	}
</style>
