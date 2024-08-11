<script>
	import { onMount } from 'svelte';
	import { course, token } from '../../stores';
	import Master from '../../layouts/Master.svelte';
	import { writable } from 'svelte/store';
	import { fade } from 'svelte/transition';

	let value = '';
	let error = '';
	let success = '';
	let requests = [];
	let counter = writable(1);

	let showModal = writable(false);
	let selectedRequest = writable(null);

	// Function to increment the counter
	const increment = () => {
		counter.update((n) => n + 1);
	};

	// Function to decrement the counter, ensuring it doesn't go below 1
	const decrement = () => {
		counter.update((n) => Math.max(n - 1, 1));
	};

	onMount(async () => {
		await fetchrequests();
	});

	function openModal(r) {
		selectedRequest.set(r);
		showModal.set(true);
	}

	function closeModal() {
		showModal.set(false);
		selectedRequest.set(null);
	}
	async function fetchrequests() {
		try {
			const storedToken = localStorage.getItem('token');
			let token = JSON.parse(storedToken);

			const response = await fetch(
				`http://localhost:3001/api/student/${$course.CourseOffering.id}/requests`,
				{
					method: 'GET',
					headers: {
						Authorization: `Bearer ${token.access_token}`
					}
				}
			);

			if (response.ok) {
				requests = await response.json();
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
	<h2 class="mt-5">List of Requests</h2>
	<table class="table table-bordered">
		<thead>
			<tr>
				<td>Requested by</td>
				<td>Reason</td>
				<td>Status</td>
				<td>Free Pass ID</td>
			</tr>
		</thead>
		<tbody>
			{#each requests as pass}
				<tr>
					<td>
						{#if pass.User}
							{pass.User.name}
						{/if}
					</td>
					<td>
						{pass.reason}
					</td>
					<td>
						{pass.status}
					</td>
					<td>
						{#if pass.FreePassPool != null}
							{pass.FreePassPool.id}
						{/if}
					</td>
				</tr>
			{/each}

			{#if requests.length == 0}
				<p>No requests, yet!</p>
			{/if}
		</tbody>
	</table>

	{#if $showModal}
		<div transition:fade={{ duration: 250 }} class={'modal-backdrop fade show'}></div>
		<div
			transition:fade={{ duration: 250 }}
			class={'modal d-block'}
			tabindex="-1"
			role="dialog"
			aria-labelledby="editProviderModalLabel"
			aria-hidden="true"
		>
			<div class="modal-dialog" role="document">
				<div class="modal-content">
					<div class="modal-header position-relative justify-content-center pt-4">
						<h5 class="modal-title" id="editProviderModalLabel">Update</h5>
						<button
							on:click={closeModal}
							type="button"
							class="close position-absolute border-0 top-50 end-0 translate-middle"
							data-dismiss="modal"
							aria-label="Close"
							style="padding-bottom: 0.2rem"
						>
							<span aria-hidden="true" class="m-0"
								><svg
									xmlns="http://www.w3.org/2000/svg"
									width="18"
									height="18"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
									class="feather feather-x"
									><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"
									></line></svg
								></span
							>
						</button>
					</div>
					<div class="modal-body">
						{#if success}
							<p class="success">{success}</p>
						{/if}

						{#if error}
							<p class="error">{error}</p>
						{/if}

						<button on:click={decrement} type="button" class="btn btn-outline-primary">-</button>
						<input type="text" readonly bind:value={$counter} />
						<button on:click={increment} type="button" class="btn btn-outline-primary">+</button>

						<div>
							<button class="btn btn-primary" on:click={() => grant($selectedRequest.id, $counter)}
								>Assign Passes</button
							>
						</div>
					</div>
				</div>
			</div>
		</div>
	{/if}
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
