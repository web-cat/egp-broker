<script>
	import { onMount } from 'svelte';
	import { course, passes, selectedPassId, token } from '../../stores';
	import Master from '../../layouts/Master.svelte';
	import { fade } from 'svelte/transition';
	import { writable } from 'svelte/store';

	let showModal = writable(false);
	let selectedStudent = writable(null);
	let courseOfferingId = writable(null);
	let passTypeId = writable(null);
	let value = '';
	let error = '';
	let success = '';
	let passCount = writable(1);
	let students = [];
	let courses = [];
	let passTypes = [];
	let selectedStudentIds = [];

	onMount(async () => {
		await fetchStudents();
		// await fetchFreePasses();
		await fetchcourses();
		await fetchPassTypes();
	});

	async function fetchcourses() {
		try {
			const storedToken = localStorage.getItem('token');
			let token = JSON.parse(storedToken);

			const response = await fetch('http://localhost:3100/api/courses', {
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

	function openModal(student) {
		selectedStudent.set(student);
		showModal.set(true);
	}

	function closeModal() {
		showModal.set(false);
		selectedStudent.set(null);
	}

	// Function to handle checkbox change
	function handleCheckboxChange(event, studentId) {
		if (event.target.checked) {
			selectedStudentIds = [...selectedStudentIds, studentId];
		} else {
			selectedStudentIds = selectedStudentIds.filter((id) => id !== studentId);
		}
	}

	function generatePassesConfirm() {
		// Swal.fire({
		// 	title: 'Are you sure?',
		// 	text: "This will provide 5 passes to every student!",
		// 	icon: 'warning',
		// 	showCancelButton: true,
		// 	confirmButtonColor: '#c61e37',
		// 	cancelButtonColor: '#838383',
		// 	confirmButtonText: 'Yes, sure!'
		// }).then((result) => {
		// 	if (result.isConfirmed) {
		// 	}
		// });
	}
	async function generatePasses() {
		try {
			if ($passTypeId == null) {
				alert('Please select a pass type');
				return;
			}
			const storedToken = localStorage.getItem('token');
			let token = JSON.parse(storedToken);

			const response = await fetch(
				`http://localhost:3100/api/generate-passes/${$course.CourseOffering.id}`,
				{
					method: 'POST',
					headers: {
						Authorization: `Bearer ${token.access_token}`,
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						passTypeId: $passTypeId,
						passCount: $passCount,
						studentIds: selectedStudentIds
					})
				}
			);

			if (response.ok) {
				success = 'Set successfully!';
				error = '';
				closeModal();
				// await fetchFreePasses();
				await fetchStudents();
			} else {
				const errorData = await response.json();
				error = errorData.error;
			}
		} catch (err) {
			error = 'An error occurred while generating free pass.';
		}
	}

	// async function fetchFreePasses() {
	// 	try {
	// 		const storedToken = localStorage.getItem('token');
	// 		let token = JSON.parse(storedToken);

	// 		const response = await fetch('http://localhost:3100/api/freepass', {
	// 			method: 'GET',
	// 			headers: {
	// 				Authorization: `Bearer ${token.access_token}`
	// 			}
	// 		});

	// 		if (response.ok) {
	// 			let allFreePasses = await response.json();

	// 			// Filter freePasses to include only those where student is null
	// 			passes.set(allFreePasses.filter((pass) => pass.Student === null));
	// 		} else {
	// 			const errorData = await response.json();
	// 			error = errorData.error;
	// 		}
	// 	} catch (err) {
	// 		error = 'An error occurred while fetching free passes.';
	// 	}
	// }

	async function fetchStudents() {
		try {
			const storedToken = localStorage.getItem('token');
			let token = JSON.parse(storedToken);

			const response = await fetch(
				`http://localhost:3100/api/course-offering/${$course?.CourseOffering.id}/students/`,
				{
					method: 'GET',
					headers: {
						Authorization: `Bearer ${token.access_token}`
					}
				}
			);

			if (response.ok) {
				students = await response.json();
			} else {
				const errorData = await response.json();
				error = errorData.error;
			}
		} catch (err) {
			error = 'An error occurred while fetching students.';
		}
	}

	async function fetchPassTypes() {
		try {
			const storedToken = localStorage.getItem('token');
			let token = JSON.parse(storedToken);

			const response = await fetch(`http://localhost:3100/api/pass-types/`, {
				method: 'GET',
				headers: {
					Authorization: `Bearer ${token.access_token}`
				}
			});

			if (response.ok) {
				passTypes = await response.json();
				if (passTypes.length > 0) {
					passTypeId.set(passTypes[0].id);
				}
			} else {
				const errorData = await response.json();
				error = errorData.error;
			}
		} catch (err) {
			error = 'An error occurred while fetching passTypes.';
		}
	}

	async function assign(id) {
		try {
			const studentId = $selectedStudent.id;
			const storedToken = localStorage.getItem('token');
			let token = JSON.parse(storedToken);

			const response = await fetch(`http://localhost:3100/api/freepass/${id}/assign/${studentId}`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${token.access_token}`,
					Content: 'application/json'
				},
				body: JSON.stringify({ studentId: studentId })
			});

			console.log(JSON.stringify({ studentId: studentId }));

			if (response.ok) {
				success = 'Set successfully!';
				error = '';
				closeModal();
				// await fetchFreePasses(); // Refresh the list after deletion
				await fetchStudents();
			} else {
				const errorData = await response.json();
				error = errorData.error;
			}
		} catch (err) {
			error = 'An error occurred while deleting the free pass.';
		}
	}

	function getPassCount(passes) {
		const counts = {};
		for (const status in passes) {
			counts[status] = passes[status].length;
		}
		return counts;
	}
</script>

<Master>
	<div class="row gx-1 my-2">
		<div class="col">
			<span class="badge bg-secondary text-white">Course: {$course.CourseOffering.Course.name}</span
			>
			<span class="badge bg-primary text-white">Term: {$course.CourseOffering.Term.name}</span>
			<span class="badge bg-primary text-white">Role: {$course.role.toUpperCase()}</span>
		</div>
		<label for="">No of passes: </label>
		<input class="col form-control" type="number" bind:value={$passCount} />

		<label for="">Pass Type: </label>
		<select required class="form-control" name="course" bind:value={$passTypeId}>
			{#each passTypes as passType}
				<option value={passType.id}>{passType.name}</option>
			{/each}
		</select>
		<button class="col btn btn-danger mt-2" type="button" on:click={generatePasses}>
			Generate {$passCount} passes for each student
		</button>
	</div>
	{#if success}
		<p class="success">{success}</p>
	{/if}

	{#if error}
		<p class="error">{error}</p>
	{/if}

	<h2 class="mt-5">List of Students</h2>
	<table class="table table-bordered">
		<thead>
			<tr>
				<td>ID</td>
				<td>Name</td>
				<td>Available Passes</td>
				<td>Used Passes</td>
				<td>Select</td>
				<!-- <td>Created</td> -->
				<!-- <td>Action</td> -->
			</tr>
		</thead>
		<tbody>
			{#each students as student}
				<tr>
					<td>{student.User.id}</td>
					<td>{student.User.name}</td>
					<td>
						{student.User.activePassCount}
					</td>
					<td>
						{student.User.usedPassCount}
					</td>
					<!-- <td>
						{student.createdAt}
					</td> -->
					<!-- <td>
						<button class="btn btn-primary" on:click={() => openModal(student)}>Assign</button>
					</td> -->
					<td>
						<input
							type="checkbox"
							on:change={(event) => handleCheckboxChange(event, student.User.id)}
						/>
					</td>
				</tr>
			{/each}
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
								{#each $passes as pass}
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
</style>
