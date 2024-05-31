<script>
    import { user } from '../stores';
    import { onMount } from 'svelte';
  
    let userProfile;
  
    onMount(() => {
      user.subscribe(value => {
        userProfile = value;
      });
    });
  </script>
  
  <main>
    <h1>Welcome, {userProfile?.name}</h1>
    <p>This is the student home page.</p>
  </main>
  