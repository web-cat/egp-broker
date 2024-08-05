<script>
	import { onMount } from 'svelte';
	import axios from 'axios';
	import { writable } from 'svelte/store';
	import { goto } from '$app/navigation';
	import AuthMaster from '../../layouts/AuthMaster.svelte';

	const token = writable(null);
	const user = writable(null);

	let email = '';
	let password = '';
	let errorMessage = '';

	const login = async () => {
		try {
			const response = await axios.post('http://localhost:3100/api/login', { email, password });
			localStorage.setItem('user', JSON.stringify(response.data.user));
			localStorage.setItem('token', JSON.stringify(response.data.token));

			user.set(response.data.user);
			token.set(response.data.token);
			goto('/home');
		} catch (error) {
			errorMessage = error.response?.data?.error || 'Login failed';
		}
	};
	const redirectToCanvasAuth = () => {
		const authUrl = 'http://192.168.1.68:3091/login/oauth2/auth?response_type=code&redirect_uri=http://localhost:5173/lti/launch&client_id=10000000000014&scope=https://purl.imsglobal.org/spec/lti-ags/scope/lineitem';
		window.location.href = authUrl;
	};
</script>

<AuthMaster>
	<div class="">
		<div class="row ">
			<div class="col-md-4 h-full bg-signin text-center text-white p-5 gap-2">
				<h3>Sign in</h3>
				<p></p>
			</div>
			<div class="col-md-8 h-full d-flex flex-column justify-content-center align-items-center">
				<div class="text-center">
					<h5>Sign In</h5>
					<p class="text-muted"></p>
				</div>
				<form class="form-group" on:submit|preventDefault={login}>
					<label for="email">Email:</label>
					<input class="form-control" id="email" type="email" bind:value={email} required />

					<label for="password">Password:</label>
					<input
						class="form-control"
						id="password"
						type="password"
						bind:value={password}
						required
					/>

					<button class="btn btn-primary" type="submit">Login</button>

				</form>
				<!-- <button on:click={redirectToCanvasAuth}>Login with canvas</button> -->


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
