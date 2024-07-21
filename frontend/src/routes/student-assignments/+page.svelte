<script>
	import { onMount } from 'svelte';
	import { course, passes, selectedPassId, token } from '../../stores';
	import Master from '../../layouts/Master.svelte';
	import { fade } from 'svelte/transition';
	import { writable } from 'svelte/store';

	let showModal = writable(false);
	let selectedAssignment = writable(null);
	let courseOfferingId = writable(null);
	let value = '';
	let error = '';
	let success = '';
	let passCount = writable(1);
	let students = [];
	let assignments = [];
	let freePasses = [];
	let courseNamesMap = {}; // To store course names by ID


	onMount(async () => {
		await fetchassignments();
	});

	async function fetchFreePasses() {
		// Check if an assignment is selected before fetching
		if (!$selectedAssignment) {
			return;
		}

		try {
			const storedToken = localStorage.getItem("token");
			const token = JSON.parse(storedToken);
			const response = await fetch(
					`http://localhost:3100/api/freepassPool/${$selectedAssignment.courseOfferingId}?tags=${$selectedAssignment.tags}`,
					{
						method: "GET",
						headers: {
							Authorization: `Bearer ${token.access_token}`,
						},
					}
			);

			if (response.ok) {
				freePasses = await response.json();
				console.log('free passes', freePasses);
			} else {
				const errorData = await response.json();
				error = errorData.error ? errorData.error : 'No free passes found for this assignment.';
			}
		} catch (err) {
			error = 'An error occurred while fetching free passes.';
		}
	}
	async function fetchassignments() {
		try {
			const storedToken = localStorage.getItem('token');
			let token = JSON.parse(storedToken);

			const response = await fetch(`http://localhost:3100/api/course-offering/${$course.courseOfferingId._id}/assignments/`, {
				method: 'GET',
				headers: {
					Authorization: `Bearer ${token.access_token}`
				}
			});

			if (response.ok) {
				assignments = await response.json();
			} else {
				const errorData = await response.json();
				error = errorData.error;
			}
		} catch (err) {
			error = 'An error occurred while fetching courses.';
		}
	}

	function openModal(assignment) {
		selectedAssignment.set(assignment);
		fetchFreePasses(); // Fetch free passes when modal is opened
		showModal.set(true);

	}

	function closeModal() {
		showModal.set(false);
		selectedAssignment.set(null);
		freePasses = []; // Reset freePasses array when modal closes

	}


	async function use(assignmentId, passValue) {
		console.log('assignment ', assignmentId);
		console.log('pass', passValue);

		try {
			const storedToken = localStorage.getItem('token');
			let token = JSON.parse(storedToken);

			const response = await fetch(
					`http://localhost:3100/api/use-pass/${assignmentId}/${passValue}`,
					{
						method: 'POST',
						headers: {
							Authorization: `Bearer ${token.access_token}`
						}
					}
			);

			if (response.ok) {
				success = 'Free pass used successfully!';
				error = '';
				closeModal();
				fetchFreePasses();
			} else {
				const errorData = await response.json();
				error = errorData.error;
				alert(error); // Or handle the error in a more user-friendly way
			}
		} catch (err) {
			error = 'An error occurred while using the free pass.';
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

	<h2 class="mt-5">List of Assignments</h2>
	<div class="table-responsive">
		<table class="table table-bordered">
			<thead>
			<tr>
				<td>ID</td>
				<td>Title</td>
				<td>Description</td>
				<td>Tags</td>
				<td>Action</td>
			</tr>
			</thead>
			<tbody>
			{#each assignments as assignment}
				<tr>
					<td>{assignment._id}</td>
					<td>{assignment.title}</td>
					<td>{assignment.description}</td>
					<td>{assignment.tags}</td>
					<td>
						<button class="btn btn-primary" on:click={() => openModal(assignment)}>Use FreePass</button>
					</td>
				</tr>
			{/each}
			</tbody>
		</table>
	</div>

	{#if $showModal}
		<div transition:fade={{ duration: 250 }} class="modal-backdrop fade show"></div>
		<div transition:fade={{ duration: 250 }} class="modal d-block" tabindex="-1" role="dialog" aria-labelledby="editProviderModalLabel" aria-hidden="true">
			<div class="modal-dialog" role="document">
				<div class="modal-content">
					<div class="modal-header position-relative justify-content-center pt-4">
						<h5 class="modal-title" id="editProviderModalLabel">Update</h5>
						<button on:click={closeModal} type="button" class="close position-absolute border-0 top-50 end-0 translate-middle" data-dismiss="modal" aria-label="Close" style="padding-bottom: 0.2rem">
							<span aria-hidden="true" class="m-0">
								<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-x">
									<line x1="18" y1="6" x2="6" y2="18"></line>
									<line x1="6" y1="6" x2="18" y2="18"></line>
								</svg>
							</span>
						</button>
					</div>
					<div class="modal-body">
						<table class="table table-bordered">
							<thead>
							<tr>
								<th>Type</th>
								<th>Pass Value</th>
								<th>Pass Type</th>

								<th>Action</th>
							</tr>
							</thead>
							<tbody>
							{#each freePasses.filter(pass => pass.status === 'active') as pass}
								<tr>
									<td>{pass?.courseOfferingId?.courseId?.name}</td>
									<td>{pass.value}</td>
									<td>{pass?.passTypeId?.tags}</td>
									<td>
										<button class="btn btn-primary" on:click={() => use($selectedAssignment._id, pass.value)}>Use</button>
									</td>
								</tr>
							{/each}

							{#if freePasses.length === 0 || !freePasses.some(pass => pass.status === 'active')}
								<p>No active free passes available.</p>
							{/if}
							</tbody>
						</table>
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
	.table-responsive {
		overflow-x: auto;
		width: 100%;
	}
</style>
