<script>
	import { onMount } from 'svelte';
	import { token } from '../../../stores';
	import Master from '../../../layouts/Master.svelte';
	import { writable } from 'svelte/store';
	import { goto } from '$app/navigation';

	let value = '';
	let error = '';
	let success = '';
	let courses = [];

	onMount(async () => {
		await fetchcourses();
		// Check role after fetching courses
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

	async function fetchcourses() {
		try {
			const storedToken = localStorage.getItem('token');
			let token = JSON.parse(storedToken);

			const response = await fetch('http://localhost:3100/api/my-courses', {
				method: 'GET',
				headers: {
					Authorization: `Bearer ${token.access_token}`
				}
			});

			if (response.ok) {
				courses = await response.json();
			} else {
				const errorData = await response.json();
				error = errorData.error;
			}
		} catch (err) {
			error = 'An error occurred while fetching courses.';
		}
	}
</script>

<Master>
	
	{#if success}
		<p class="success">{success}</p>
	{/if}

	{#if error}
		<p class="error">{error}</p>
	{/if}

	<h2 class="mt-5">My Courses</h2>
	<table class="table table-bordered">
		<thead>
			<tr>
				<td>ID</td>
				<td>Name</td>
			</tr>
		</thead>
		<tbody>
			{#each courses as course}
				<tr>
					<td>
						{course.id}
					</td>
					<td>
						{course.name}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</Master>

<style>
	.success {
		color: green;
	}
	.error {
		color: red;
	}
	ul {
		list-style-type: none;
		padding: 0;
	}
	li {
		margin: 10px 0;
	}
</style>
