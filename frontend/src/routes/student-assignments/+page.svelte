<script>
	import { onMount } from 'svelte';
	import { course, passes, selectedPassId, token } from '../../stores';
	import Master from '../../layouts/Master.svelte';
	import { fade } from 'svelte/transition';
	import { writable } from 'svelte/store';

	export let data;

	let showModal = writable(false);
	let selectedAssignment = writable(null);
	let selectedAssignmentId = null;
	let courseOfferingId = writable(null);
	let value = '';
	let error = '';
	let success = '';
	let passCount = writable(1);
	let students = [];
	let assignments = [];
	let freePasses = [];
	let courseNamesMap = {};

	onMount(async () => {
// This assumes that the load function in +page.server.js returns the assignments as an array
		assignments = data.assignments;
		console.log("Fetched assignments:", assignments);
	});

	// Reactive update of selectedAssignmentId
	$: if ($selectedAssignment) {
		selectedAssignmentId = $selectedAssignment.courseOfferingId;
	}


	async function fetchFreePasses() {
		if (!$selectedAssignment) {
			return;
		}
		const tags = $selectedAssignment.tags || 'Class';
		try {
			const storedToken = localStorage.getItem("token");
			const token = JSON.parse(storedToken);
			const response = await fetch(
					`http://localhost:3100/api/freepassPool/${$selectedAssignment.id}?tags=${tags}`,
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
</script>

<Master>
	{#if success}
		<p class="success">{success}</p>
	{/if}

	{#if error}
		<p class="error">{error}</p>
	{/if}

	<div class="button-container"><h2 class="mt-5">List of Assignments</h2>
		<button>Sync with Canvas</button>
	</div>
	<div class="table-responsive">
		<table class="table table-bordered">
			<thead>
			<tr>
				<td>ID</td>
				<td>Title</td>
				<td>Description</td>
				<td>Due At</td>
				<td>Points Possible</td>
				<td>Action</td>
			</tr>
			</thead>
			<tbody>
			{#each assignments as assignment (assignment.id)}
				<tr>
					<td>{assignment.id}</td>
					<td>{assignment.name}</td>
					<td>{@html assignment.description}</td>
					<td>{assignment.due_at}</td>
					<td>{assignment.points_possible}</td>
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
		<div transition:fade={{ duration: 250 }} class="modal d-block" tabindex="-1" role="dialog"
			 aria-labelledby="editProviderModalLabel" aria-hidden="true">
			<div class="modal-dialog" role="document">
				<div class="modal-content">
					<div class="modal-header position-relative justify-content-center pt-4">
						<h5 class="modal-title" id="editProviderModalLabel">Update</h5>
						<button on:click={closeModal} type="button"
								class="close position-absolute border-0 top-50 end-0 translate-middle"
								data-dismiss="modal" aria-label="Close" style="padding-bottom: 0.2rem">
<span aria-hidden="true" class="m-0">
<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
	 stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
	 class="feather feather-x">
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
										<button class="btn btn-primary"
												on:click={() => use($selectedAssignment.id, pass.value)}>Use
										</button>
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

	.button-container {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
</style>