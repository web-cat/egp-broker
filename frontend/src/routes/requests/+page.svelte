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
		console.log('Component mounted, fetching requests...');
		await fetchRequests();
	});

	function openModal(r) {
		selectedRequest.set(r);
		showModal.set(true);
	}

	function closeModal() {
		showModal.set(false);
		selectedRequest.set(null);
	}

	async function fetchRequests() {
		try {
			const storedToken = localStorage.getItem('token');
			const courseToken = localStorage.getItem('course');

			let token = JSON.parse(storedToken)
			let course = JSON.parse(courseToken);

			console.log('Token:', token);
			console.log('course:', course);

			// Check if course and CourseOffering are available
			if (course.courseOfferingId._id) {
				console.log('Course Offering ID:', course.courseOfferingId._id);

				const response = await fetch(
						`https://egp-broker.cs.vt.edu/egp-broker-service/api/instructor/${course.courseOfferingId._id}/requests`,
						{
							method: 'GET',
							headers: {
								Authorization: `Bearer ${token.access_token}`
							}
						}
				);

				if (response.ok) {
					requests = await response.json();
					console.log('Fetched requests:', requests);
				} else {
					const errorData = await response.json();
					error = errorData.error;
					console.log('Error fetching requests:', error);
				}
			} else {
				error = 'Course Offering ID is not available';
				console.log('course',course.courseOfferingId)

				console.log('Course Offering ID is not available');
			}
		} catch (err) {
			error = 'An error occurred while fetching free passes.';
			console.log('Error fetching requests:', err);
		}
	}

	async function submitFreePassRequest() {
		try {
			const storedToken = localStorage.getItem('token');
			let token = JSON.parse(storedToken);

			const response = await fetch('https://egp-broker.cs.vt.edu/egp-broker-service/api/freepass', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token.access_token}`
				},
				body: JSON.stringify({ value })
			});

			if (response.ok) {
				const result = await response.json();
				success = 'Free pass created successfully!';
				value = '';
				error = '';
				await fetchRequests(); // Refresh the list after creating a new pass
			} else {
				const errorData = await response.json();
				error = errorData.error;
				console.log('Error creating free pass:', error);
			}
		} catch (err) {
			error = 'An error occurred while creating the free pass.';
			console.log('Error creating free pass:', err);
		}
	}

	async function grant(id, count) {
		try {
			console.log('grant count',count)
			const storedToken = localStorage.getItem('token');
			let token = JSON.parse(storedToken);

			const response = await fetch(
					`https://egp-broker.cs.vt.edu/egp-broker-service/api/instructor/grant-pass/${id}/${count}`,
					{
						method: 'POST',
						headers: {
							Authorization: `Bearer ${token.access_token}`
						}
					}
			);

			if (response.ok) {
				success = 'Free pass granted successfully!';
				error = '';
				closeModal();
				await fetchRequests(); // Refresh the list after granting
			} else {
				const errorData = await response.json();
				error = errorData.error;
				console.log('Error granting free pass:', error);
				alert(error);
			}
		} catch (err) {
			error = 'An error occurred while granting the free pass.';
			console.log('Error granting free pass:', err);
		}
	}

	async function reject(id) {
		try {
			const storedToken = localStorage.getItem('token');
			let token = JSON.parse(storedToken);

			const response = await fetch(
					`https://egp-broker.cs.vt.edu/egp-broker-service/api/instructor/reject-pass/${id}`,
					{
						method: 'POST',
						headers: {
							Authorization: `Bearer ${token.access_token}`
						}
					}
			);

			if (response.ok) {
				success = 'Free pass rejected successfully!';
				error = '';
				closeModal();
				await fetchRequests(); // Refresh the list after rejecting
			} else {
				const errorData = await response.json();
				error = errorData.error;
				console.log('Error rejecting free pass:', error);
				alert(error);
			}
		} catch (err) {
			error = 'An error occurred while rejecting the free pass.';
			console.log('Error rejecting free pass:', err);
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
			<!-- <td>Course</td>
            <td>Created</td> -->
			<td>Action</td>
		</tr>
		</thead>
		<tbody>
		{#each requests as pass}
			<tr>
				<td>
					{#if pass.userId}
						{pass.userId.name}
					{/if}
				</td>
				<td>
					{pass.reason}
				</td>
				<td>
					{pass.status}
				</td>
				<!-- <td>
                    {pass.Course?.name}
                </td>
                <td>
                    {pass.timestamp}
                </td> -->
				<td>
					<button
							class="btn btn-danger"
							on:click={() => {
                                selectedRequest.set(pass);
                                reject(pass._id);
                            }}>Reject</button>
					<button
							class="btn btn-success"
							on:click={() => {
                                selectedRequest.set(pass);
                                grant(pass._id, 1);
                            }}>Grant</button>
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
							>Assign Passes</button>
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
		margin: 5px 0;
	}
</style>
