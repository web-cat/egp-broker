<script>
	import { onMount } from 'svelte';
	import { token } from '../../../stores';
	import Master from '../../../layouts/Master.svelte';
	import { writable } from 'svelte/store';

	let value = '';
	let error = '';
	let success = '';
	let courseId = writable(null);
	let freePasses = [];
	let courses = [];

	onMount(async () => {
		await fetchFreePasses();
		await fetchcourses();
	});

	async function fetchFreePasses() {
		try {
			const storedToken = localStorage.getItem('token');
			let token = JSON.parse(storedToken);

			const response = await fetch('http://localhost:3001/api/freepass', {
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

	async function fetchcourses() {
		try {
			const storedToken = localStorage.getItem('token');
			let token = JSON.parse(storedToken);

			const response = await fetch('http://localhost:3001/api/my-courses', {
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

	async function submitFreePassRequest() {
		try {
			const storedToken = localStorage.getItem('token');
			let token = JSON.parse(storedToken);

			const response = await fetch('http://localhost:3001/api/freepass', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token.access_token}`
				},
				body: JSON.stringify({ value, courseId })
			});

			if (response.ok) {
				const result = await response.json();
				success = 'Free pass created successfully!';
				value = '';
				error = '';
				await fetchFreePasses(); // Refresh the list after creating a new pass
			} else {
				const errorData = await response.json();
				error = errorData.error;
			}
		} catch (err) {
			error = 'An error occurred while creating the free pass.';
		}
	}

	async function deleteFreePass(id) {
		try {
			const storedToken = localStorage.getItem('token');
			let token = JSON.parse(storedToken);

			const response = await fetch(`http://localhost:3001/api/freepass/${id}`, {
				method: 'DELETE',
				headers: {
					Authorization: `Bearer ${token.access_token}`
				}
			});

			if (response.ok) {
				success = 'Free pass deleted successfully!';
				error = '';
				await fetchFreePasses(); // Refresh the list after deletion
			} else {
				const errorData = await response.json();
				error = errorData.error;
			}
		} catch (err) {
			error = 'An error occurred while deleting the free pass.';
		}
	}

	function generateValue() {
        value = Math.floor(Math.random() * 10000000).toString();
    }
</script>

<Master>
	<form class="form-group" on:submit|preventDefault={submitFreePassRequest}>
		<div class="input-group">
			<input
					placeholder="Value"
					class="form-control"
					type="number"
					id="value"
					bind:value={value}
					required
				/>
				Course:
				<select class="form-control" name="course" bind:value={courseId}>
					{#each courses as course}
						<option value="{course.id}">{course.name}</option>
					{/each}
				</select>
			<div class="input-group-append">
			  <button class="btn btn-outline-secondary" on:click={generateValue} type="button">🔀</button>
			  <button class="btn btn-primary" type="submit">Add Pass</button>
			</div>
		  </div>
	</form>

	{#if success}
		<p class="success">{success}</p>
	{/if}

	{#if error}
		<p class="error">{error}</p>
	{/if}

	<h2 class="mt-5">List of Free Passes</h2>
	<table class="table table-bordered">
		<thead>
			<tr>
				<td>Value</td>
				<td>Status</td>
				<td>Granted to</td>
				<td>Course</td>
				<td>Created</td>
				<td>Action</td>
			</tr>
		</thead>
		<tbody>
			{#each freePasses as pass}
				<tr>
					<td>
						{pass.value}
					</td>
					<td>
						{pass.status}
					</td>
					<td>
						{#if pass.Student}
							{pass.Student.name}
						{/if}
					</td>
					<td>
						{#if pass.Course}
							{pass.Course.name}
						{/if}
					</td>
					<td>
						{pass.timestamp}
					</td>
					<td>
						<button class="btn btn-danger" on:click={() => deleteFreePass(pass.id)}>Delete</button>
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
