<script>
  import { onMount } from 'svelte';
  import axios from 'axios';
  import { writable } from 'svelte/store';
	import { goto } from '$app/navigation';

  const token = writable(null);
  const user = writable(null);

  let email = '';
  let password = '';
  let errorMessage = '';

  const login = async () => {
    try {
      const response = await axios.post('http://localhost:3100/api/login', { email, password });
      if (response.data.user.role === 'instructor') {
        localStorage.setItem('user', JSON.stringify(response.data.user));
				localStorage.setItem('token', JSON.stringify(response.data.token));

				user.set(response.data.user);
				token.set(response.data.token);
        goto('/instructor-home');
      } else {
        goto('/student-home');
      }
    } catch (error) {
      errorMessage = error.response?.data?.error || 'Login failed';
    }
  };
</script>

<main>
  <h1>Login</h1>
  <form on:submit|preventDefault={login}>
    <label for="email">Email:</label>
    <input id="email" type="email" bind:value={email} required />

    <label for="password">Password:</label>
    <input id="password" type="password" bind:value={password} required />

    <button type="submit">Login</button>
  </form>

  {#if errorMessage}
    <p style="color: red;">{errorMessage}</p>
  {/if}
</main>

<style>
  main {
    max-width: 400px;
    margin: 0 auto;
    padding: 1rem;
    text-align: center;
  }

  label, input {
    display: block;
    width: 100%;
    margin-bottom: 1rem;
  }
</style>
