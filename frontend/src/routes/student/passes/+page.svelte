<script>
	import { onMount } from 'svelte';
	import { token } from '../../../stores';
	import Master from '../../../layouts/Master.svelte';
	import { writable } from 'svelte/store';

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
		await fetchCourses();
	});

	async function fetchCourses() {
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

	async function fetchFreePasses() {
		try {
			const storedToken = localStorage.getItem('token');
			let token = JSON.parse(storedToken);

			const response = await fetch('http://localhost:3100/api/freepass', {
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

	async function submitFreePassRequest() {
		try {
			const storedToken = localStorage.getItem('token');
			let token = JSON.parse(storedToken);

			const response = await fetch('http://localhost:3100/api/freepassrequest', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token.access_token}`
				},
				body: JSON.stringify({ reason })
			});

			if (response.ok) {
				const result = await response.json();
				success = 'Free pass request sent successfully!';
				error = '';
				await fetchFreePasses(); // Refresh the list after creating a new pass
			} else {
				const errorData = await response.json();
				error = errorData.error;
			}
		} catch (err) {
			error = err;
		}
	}

	async function use(id) {
		try {
			const storedToken = localStorage.getItem('token');
			let token = JSON.parse(storedToken);

			const response = await fetch(`http://localhost:3100/api/freepass-use/${id}`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${token.access_token}`
				}
			});

			if (response.ok) {
				success = 'Free pass used successfully!';
				error = '';
				await fetchFreePasses(); // Refresh the list after use
			} else {
				const errorData = await response.json();
				error = errorData.error;
			}
		} catch (err) {
			error = 'An error occurred while using the free pass.';
		}
	}
</script>

<Master>
	<form class="mt-5 form-group" on:submit|preventDefault={submitFreePassRequest}>
		<div class="input-group">
			<input
				placeholder="Please enter a reason for free pass"
				class="form-control"
				type="text"
				id="reason"
				bind:value={reason}
				required
			/>
			<div class="input-group-append">
				<button class="btn btn-primary" type="submit">Request Free Pass</button>
			</div>
		</div>
	</form>

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
				<td>Created</td>
				<td>Action</td>
			</tr>
		</thead>
		<tbody>
			{#each filteredPasses ?? [] as pass}
				<tr>
					<td>{pass.value}</td>
					<td>
						{#if pass.Course}
							{pass.Course.name}
						{/if}
					</td>
					<td>{pass.status}</td>
					<td>{pass.timestamp}</td>
					<td>
						{#if pass.status == 'active'}
							<button class="btn btn-danger" on:click={() => use(pass.id)}>Use</button>
						{:else}
							No action available
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
