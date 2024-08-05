<script>
    import { onMount } from 'svelte';
    export let data;

    let isLoading = false;
    let errorMessage = null;

    onMount(async () => {
        if (data.error) {
            // Handle initial authentication error from the server
            console.error('Authentication failed:', data.error);
            errorMessage = data.error;
            return;
        }

        const tokenData = data.tokenData;
        isLoading = true;

        try {
            // 1. Check if user exists in your database
            const checkUserResponse = await fetch(`http://localhost:3100/api/user/${tokenData.user.name}`);
            const checkUserResult = await checkUserResponse.json();

            if (checkUserResult.exists) {
                // User exists, directly login
                console.log("User exists, logging in...");

                const loginResponse = await fetch('http://localhost:3100/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: tokenData.user.name,
                        password: '12345678' // Or handle password appropriately
                    })
                });

                const loginResult = await loginResponse.json();

                if (loginResult) {
                    // Store ONLY the access_token in localStorage as a JSON string
                    const tokenToStore = { access_token: loginResult.token.access_token };
                    localStorage.setItem('token', JSON.stringify(tokenToStore));
                    localStorage.setItem('user', JSON.stringify(loginResult.user));
                    window.location.href = '/home'; // Redirect after login
                }
                else {
                    throw new Error('Login failed');
                }
            } else {
                // User doesn't exist, register and then login
                console.log("User doesn't exist, registering...");

                const registerResponse = await fetch('http://localhost:3100/api/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: tokenData.user.name,
                        email: tokenData.user.name,
                        password: '12345678',
                        ltiId: tokenData.user.id
                    })
                });

                const registerResult = await registerResponse.json();
                console.log('register result', registerResult);

                if (!registerResult.success) {
                    throw new Error('Registration failed: ' + registerResult.error);
                }

            //    if no register then after register
                const loginResponse = await fetch('http://localhost:3100/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: tokenData.user.name,
                        password: '12345678' // Or handle password appropriately
                    })
                });

                const loginResult = await loginResponse.json();

                if (loginResult) {
                    // Store ONLY the access_token in localStorage as a JSON string
                    const tokenToStore = { access_token: loginResult.token.access_token };
                    localStorage.setItem('token', JSON.stringify(tokenToStore));
                    localStorage.setItem('user', JSON.stringify(loginResult.user));
                    window.location.href = '/home'; // Redirect after login
                }
                else {
                    throw new Error('Login failed');
                }
            }
        } catch (error) {
            console.error('Error during authentication:', error);
            errorMessage = error.message;
        } finally {
            isLoading = false;
        }
    });
</script>



{#if isLoading}
    <p>Loading...</p>
{:else if errorMessage}
    <div class="error-message">
        <p>{errorMessage}</p>
        <button on:click={() => (errorMessage = null)}>Try Again</button>
    </div>
{:else}
    <p>Authentication successful!</p>
{/if}
