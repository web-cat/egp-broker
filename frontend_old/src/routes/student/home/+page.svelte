<script>
	import Master from '../../../layouts/Master.svelte';
	import { user } from '../../../stores';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	let userProfile;

</script>

<Master>
	<h1>Welcome, {userProfile?.name}</h1>
	<p>This is the student home page.</p>
</Master>
