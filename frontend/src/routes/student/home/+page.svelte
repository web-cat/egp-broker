<script>
	import Master from '../../../layouts/Master.svelte';
	import { user } from '../../../stores';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	let userProfile;

	onMount(() => {
		user.subscribe((value) => {
			userProfile = value;
		});
		// Check role after fetching user
		const storedToken = localStorage.getItem('course');
		if (storedToken) {
			const courseData = JSON.parse(storedToken);
			const role = courseData?.role;
			console.log(role)
			// Check if the user is not a student and redirect
			if (role !== 'student') {
				goto('/home');
			}
		} else {
			goto('/'); // Redirect if no token is found
		}

	});
</script>

<Master>
	<h1>Welcome, {userProfile?.name}</h1>
	<p>This is the student home page.</p>
</Master>
