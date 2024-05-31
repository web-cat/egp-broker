<script>
	import { onMount } from 'svelte';
	import { token } from '../../../stores';
	import Master from '../../../layouts/Master.svelte';
	import { writable } from 'svelte/store';

	let reason = '';
	let error = '';
	let success = '';
	let freePasses = [];
	let counter = 1;
	let filter = writable('all');

	onMount(async () => {
		await fetchFreePasses();
	});

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
			error = 'An error occurred while useing the free pass.';
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
			<h2>List of Passes</h2>
		</div>
		<div class="col-auto">
			<select class="form-control" bind:value={$filter}>
				<option value="all">All</option>
				<option value="used">Used</option>
				<option value="active">Active</option>
			</select>
		</div>
	</div>

	<table class="table table-bordered">
		<thead>
			<tr>
				<td>Value</td>
				<td>Status</td>
				<td>Created</td>
				<td>Action</td>
			</tr>
		</thead>
		<tbody>
			{#if $filter == 'all'}
				{#each freePasses ?? [] as pass}
					<tr>
						<td>
							{pass.value}
						</td>
						<td>
							{pass.status}
						</td>
						<td>
							{pass.timestamp}
						</td>
						<td>
							{#if pass.status == 'active'}
								<button class="btn btn-danger" on:click={() => use(pass.id)}>Use</button>
							{:else}
								No action available
							{/if}
						</td>
					</tr>
				{/each}

				{#if freePasses.length == 0}
				<p>
					No free passes available, Please request!
				</p>
				{/if}
			{:else if $filter == 'active'}
				{#each freePasses.filter((pass) => pass.status === 'active') as pass}
					<tr>
						<td>
							{pass.value}
						</td>
						<td>
							{pass.status}
						</td>
						<td>
							{pass.timestamp}
						</td>
						<td>
							{#if pass.status == 'active'}
								<button class="btn btn-danger" on:click={() => use(pass.id)}>Use</button>
							{:else}
								No action available
							{/if}
						</td>
					</tr>
				{/each}
				{#if freePasses.filter((pass) => pass.status === 'active').length == 0}
					<p>
						No free passes available, Please request!
					</p>
				{/if}
			{:else if $filter == 'used'}
				{#each freePasses.filter((pass) => pass.status === 'used') as pass}
					<tr>
						<td>
							{pass.value}
						</td>
						<td>
							{pass.status}
						</td>
						<td>
							{pass.timestamp}
						</td>
						<td> No action available </td>
					</tr>
				{/each}

				{#if freePasses.filter((pass) => pass.status === 'used').length == 0}
					<p>
						No used free passes yet!
					</p>
				{/if}
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
