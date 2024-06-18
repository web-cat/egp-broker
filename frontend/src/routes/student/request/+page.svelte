<script>
	import { onMount } from 'svelte';
	import { token, course } from '../../../stores';
	import Master from '../../../layouts/Master.svelte';
	import { writable } from 'svelte/store';

	let reason = '';
	let error = '';
	let success = '';
	let passTypeId = writable("1");

	onMount(async () => {
		
	});

	async function submitFreePassRequest() {
		try {
			const storedToken = localStorage.getItem('token');
			let token = JSON.parse(storedToken);

			let courseOfferingId = $course.CourseOffering.id;
			const response = await fetch('http://localhost:3100/api/freepassrequest', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token.access_token}`
				},
				body: JSON.stringify({ reason, courseOfferingId, passTypeId })
			});

			if (response.ok) {
				const result = await response.json();
				success = 'Free pass request sent successfully!';
				error = '';
			} else {
				const errorData = await response.json();
				error = errorData.error;
			}
		} catch (err) {
			error = err;
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
				<label for="">Pass Type</label>
				<select required class="form-control" name="course" bind:value={passTypeId}>
					<option value="1">Default Pass Type</option>
				</select>
			</div>
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
