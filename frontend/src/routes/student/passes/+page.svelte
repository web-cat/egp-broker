<script>
	import { onMount } from 'svelte';
	import { course, token } from '../../../stores';
	import Master from '../../../layouts/Master.svelte';
	import { writable } from 'svelte/store';
	import { goto } from '$app/navigation';

	let reason = '';
	let error = '';
	let success = '';
	let freePasses = [];
	let courses = [];
	let filter = writable('all');
	let courseId = writable(null);

	// Reactive statement to update filteredPasses based on filter and courseId
	$: filteredPasses = freePasses.filter((pass) => {
		const matchesFilter = $filter === 'all' || pass.status === $filter;
		const matchesCourse = !$courseId || pass.courseId === $courseId;
		return matchesFilter && matchesCourse;
	});

	onMount(async () => {
		await fetchFreePasses();

		// Check role after fetching free passes
		const storedToken = localStorage.getItem('course');
		if (storedToken) {
			const courseData = JSON.parse(storedToken);
			const role = courseData?.role;
			console.log(role)
			// Check if the user is not a student and redirect
			if (role !== 'student') {
				goto('/home');
			}
		}

	});


	async function fetchFreePasses() {
		try {
			const storedToken = localStorage.getItem('token');
			let token = JSON.parse(storedToken);

			const response = await fetch(`http://localhost:3100/api/freepassPool/${$course.courseOfferingId._id}`, {
				method: 'GET',
				headers: {
					Authorization: `Bearer ${token.access_token}`
				}
			});
			if (response.ok) {
				freePasses = await response.json();
			} else {
				const errorData = await response.json();
				error = errorData.error;
			}
		} catch (err) {
			error = 'An error occurred while fetching free passes.';
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

	<div class="mt-5 row">
		<div class="col">
			<h2>List of Passes ({filteredPasses.length})</h2>
		</div>
		<div class="col-auto">
			<select class="form-control" bind:value={$filter}>
				<option value="all">All</option>
				<option value="used">Used</option>
				<option value="active">Active</option>
			</select>
		</div>
		<div class="col-auto">
			<select class="form-control" bind:value={$courseId}>
				<option value={null}>All</option>
				{#each courses ?? [] as course}
					<option value={course.id}>{course.name}</option>
				{/each}
			</select>
		</div>
	</div>

	<table class="table table-bordered">
		<thead>
			<tr>
				<td>Value</td>
				<td>Course</td>
				<td>Status</td>
				<!-- <td>Created</td> -->
				<td>Action</td>
			</tr>
		</thead>
		<tbody>
			{#each filteredPasses ?? [] as pass}
				<tr>
					<td>{pass.value}</td>
					<td>
						{#if pass.courseOfferingId?.courseId}
							{pass.courseOfferingId?.courseId?.name}
						{/if}
					</td>
					<td>{pass.status}</td>
<!--					<td>{pass.timestamp}</td> -->
					<td>
						{#if pass.status == 'active'}
							Available
						{:else}
							Not available
						{/if}
					</td>
				</tr>
			{/each}

			{#if filteredPasses.length == 0}
				<p>No free passes available, Please request!</p>
			{/if}
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
