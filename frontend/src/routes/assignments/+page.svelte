<script>
	import { onMount } from 'svelte';
	import { course, passes, selectedPassId, token } from '../../stores';
	import Master from '../../layouts/Master.svelte';
	import { fade } from 'svelte/transition';
	import { writable } from 'svelte/store';

	let showModal = writable(false);
	let selectedStudent = writable(null);
	let courseOfferingId = writable(null);
	let value = '';
	let error = '';
	let success = '';
	let passCount = writable(1);
	let students = [];
	let assignments = [];

	onMount(async () => {
		await fetchassignments();
	});

	async function fetchassignments() {
		try {
			const storedToken = localStorage.getItem('token');
			let token = JSON.parse(storedToken);

			// alert(JSON.stringify($course))
			const response = await fetch(`http://localhost:3001/api/course-offering/${$course.courseOfferingId._id}/assignments/`, {
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
			error = 'An error occurred while fetching assignements.';
		}
	}

	function openModal(student) {
		selectedStudent.set(student);
		showModal.set(true);
	}

	function closeModal() {
		showModal.set(false);
		selectedStudent.set(null);
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
				<!-- <td>Created</td> -->
				<!-- <td>Action</td> -->
			</tr>
			</thead>
			<tbody>
			{#each assignments as assignment}
				<tr>
					<td>{assignment._id}</td>
					<td>{assignment.title}</td>
					<td>{assignment.description}</td>
					<td>
						{assignment.tags}
					</td>
					<!-- <td>
						{student.createdAt}
					</td> -->
					<!-- <td>
						<button class="btn btn-primary" on:click={() => openModal(student)}>Assign</button>
					</td> -->
				</tr>
			{/each}
			</tbody>
		</table>
	</div>

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
							<span aria-hidden="true" class="m-0">
								<svg
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
								>
									<line x1="18" y1="6" x2="6" y2="18"></line>
									<line x1="6" y1="6" x2="18" y2="18"></line>
								</svg>
							</span>
						</button>
					</div>
					<div class="modal-body">
						<table class="table table-bordered">
							<thead>
								<th>Pass Value</th>
								<th>Action</th>
							</thead>
							<tbody>
								{#each freePasses as pass}
									<tr>
										<td>{pass.value}</td>
										<td>
											<button class="btn btn-primary" on:click={() => assign(pass.id)}>
												Assign
											</button>
										</td>
									</tr>
								{/each}
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
	.table-responsive{
		width: 100%;
		overflow-x: auto;
	}
</style>
