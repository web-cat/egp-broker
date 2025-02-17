<script>
	import Master from '../../../layouts/Master.svelte';
	import { user } from '../../../stores';
	import { onMount } from 'svelte';

	let userProfile;

	onMount(() => {
		user.subscribe((value) => {
			userProfile = value;
		});
	});
</script>

<Master>
	<h1>Welcome, {userProfile?.name}</h1>
	<p>This is the instructor home page.</p>
	<a href="/instructor/freepass">Create +</a>
</Master>
