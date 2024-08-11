<script>
	import { createEventDispatcher, onMount } from 'svelte';
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
	let showPassTypeForm = false;
	let tags = []; // Array to hold the tags
	let inputTag = '';

	let passType = {
		name: '',
		description: '',
		tags: '',
		initialCount: '',
		validityPeriod: ''
	};

	const dispatch = createEventDispatcher();

	// Function to handle form submission
	async function handleSubmit(event) {
		event.preventDefault();

		const storedToken = localStorage.getItem('token');
		let token = JSON.parse(storedToken);

		try {
			const response = await fetch('http://localhost:3001/api/pass-types', {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${token.access_token}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(passType)
			});

			if (response.ok) {
				const result = await response.json();
				dispatch('passTypeSaved', result);
				// alert('Pass type saved successfully!');
				passTypeId.set(result._id);
				fetchPassTypes();
				showPassTypeForm = false;
				resetForm();
			} else {
				const errorData = await response.json();
				alert(`Error: ${errorData.error}`);
			}
		} catch (error) {
			alert(`Error: ${error.message}`);
		}
	}

	// Function to reset the form
	function resetForm() {
		passType = {
			name: '',
			description: '',
			tags: '',
			initialCount: '',
			validityPeriod: ''
		};
	}
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

			const response = await fetch('http://localhost:3001/api/courses', {
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
			console.log('selectedStudentIds', selectedStudentIds);
			const response = await fetch(
				`http://localhost:3001/api/generate-passes/${$course.courseOfferingId._id}`,
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

	// 		const response = await fetch('http://localhost:3001/api/freepass', {
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
				`http://localhost:3001/api/course-offering/${$course?.courseOfferingId._id}/students/`,
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

			const response = await fetch(`http://localhost:3001/api/pass-types/`, {
				method: 'GET',
				headers: {
					Authorization: `Bearer ${token.access_token}`
				}
			});

			if (response.ok) {
				passTypes = await response.json();
				if (passTypes.length > 0 && $passTypeId == null) {
					passTypeId.set(passTypes[0]._id);
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

			const response = await fetch(
				`http://localhost:3001/api/freepass/${id}/assign/${studentId}`,
				{
					method: 'POST',
					headers: {
						Authorization: `Bearer ${token.access_token}`,
						Content: 'application/json'
					},
					body: JSON.stringify({ studentId: studentId })
				}
			);

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

	function handleSelectAllChange(event) {
		const isChecked = event.target.checked;
		if (isChecked) {
			selectedStudentIds = students.map((student) => student.userId._id);
		} else {
			selectedStudentIds = [];
		}
		students.forEach((student) => {
			document.getElementById(`student-checkbox-${student.userId._id}`).checked = isChecked;
		});
	}

	// Function to add a tag
	function addTag() {
		const newTag = inputTag.trim();
		if (newTag && !tags.includes(newTag)) {
			tags = [...tags, newTag];
			passType.tags = tags;
		}
		inputTag = ''; // Clear the input field
	}

	// Function to remove a tag
	function removeTag(tag) {
		tags = tags.filter((t) => t !== tag);
		passType.tags = tags;
	}

	// Handle keypress for Enter or comma
	function handleKeyPress(event) {
		if (event.key === 'Enter' || event.key === ',') {
			event.preventDefault(); // Prevent form submission
			addTag();
		}
	}
</script>

<Master>
	<div class="row gx-1 my-2">
		<div class="col">
			<span class="badge bg-secondary text-white"
				>Course: {$course.courseOfferingId.courseId.name}</span
			>
			<span class="badge bg-primary text-white">Term: {$course.courseOfferingId.termId.name}</span>
			<span class="badge bg-primary text-white">Role: {$course.role.toUpperCase()}</span>
		</div>
		<!-- <label for="">No of passes: </label>
		<input class="col form-control" type="number" bind:value={$passCount} /> -->

		<!-- <label for="">Pass Type: </label> -->
		<div class="d-flex mt-2">
			<!-- <select
				required
				class="form-control mr-2"
				style="flex:1; margin-right: 1rem;"
				name="passtype"
				bind:value={$passTypeId}
			>
				{#each passTypes as passType}
					<option value={passType._id}>{passType.name}</option>
				{/each}
			</select> -->
			{#if showPassTypeForm}{:else}
				<button
					on:click={() => {
						showPassTypeForm = !showPassTypeForm;
					}}
					class="btn btn-primary ml-2">Add New Pass Type</button
				>
			{/if}
		</div>

		{#if showPassTypeForm}
			<h5>Create new Pass Type</h5>
			<form on:submit={handleSubmit}>
				<div>
					<label for="name">Name</label>
					<input required class="form-control" type="text" id="name" bind:value={passType.name} />
				</div>
				<div>
					<label for="description">Description</label>
					<textarea required class="form-control" id="description" bind:value={passType.description}
					></textarea>
				</div>
				<div>
					<label for="tags">Tags</label>
					<!-- <input required class="form-control" type="text" id="tags" bind:value={passType.tags} /> -->
					<input
						required
						class="form-control"
						type="text"
						id="tags"
						bind:value={inputTag}
						on:keydown={handleKeyPress}
						placeholder="Add a tag and press Enter or comma"
					/>

					<div class="tags-container">
						{#each tags as tag}
							<div class="tag">
								{tag} <button on:click={() => removeTag(tag)}>&times;</button>
							</div>
						{/each}
					</div>
				</div>
				<div>
					<label for="initialCount">Initial Count</label>
					<input
						required
						class="form-control"
						type="number"
						id="initialCount"
						bind:value={passType.initialCount}
					/>
				</div>
				<div>
					<label for="validityPeriod">Validity Period (days)</label>
					<input
						required
						class="form-control"
						type="number"
						id="validityPeriod"
						bind:value={passType.validityPeriod}
					/>
				</div>
				<!-- Assume userId is set elsewhere, e.g., via a hidden field or passed in -->
				<!-- <div>
				<label for="userId">User ID</label>
				<input type="number" id="userId" bind:value={passType.userId}>
			</div> -->
				<button class="btn btn-primary" type="submit">Save Pass Type</button>
			</form>
		{:else}
			<button class="col btn btn-danger mt-2" type="button" on:click={generatePasses}>
				Generate {$passCount} passes for each student
			</button>
		{/if}
	</div>
	{#if success}
		<p class="success">{success}</p>
	{/if}

	{#if error}
		<p class="error">{error}</p>
	{/if}

	<h2 class="mt-5">List of Students</h2>
	<div class="responsive-table">
		<table class="table table-bordered">
			<thead>
				<tr>
					<td>ID</td>
					<td>Name</td>
					<td>Available Passes</td>
					<td>Used Passes</td>
					<td>Select <input type="checkbox" on:change={handleSelectAllChange} /></td>
					<!-- <td>Created</td> -->
					<!-- <td>Action</td> -->
				</tr>
			</thead>
			<tbody>
				{#each students as student}
					<tr>
						<td>{student.userId._id}</td>
						<td>{student.userId.name}</td>
						<td>{student.userId.activePassCount}</td>
						<td>{student.userId.usedPassCount}</td>
						<td>
							<input
								id={`student-checkbox-${student.userId._id}`}
								type="checkbox"
								on:change={(event) => handleCheckboxChange(event, student.userId._id)}
							/>
						</td>
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

	.tags-container {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 8px;
	}

	.tag {
		display: inline-block;
		background-color: #007bff;
		color: white;
		padding: 4px 8px;
		border-radius: 12px;
		font-size: 14px;
	}

	.tag button {
		background: none;
		border: none;
		color: white;
		margin-left: 8px;
		cursor: pointer;
	}
</style>
