<script>
    import { onMount } from 'svelte';
    import { token, course } from '../../../stores';
    import Master from '../../../layouts/Master.svelte';
    import { writable } from 'svelte/store';

    let reason = '';
    let error = '';
    let success = '';
    let passTypes = [];
    let passTypeId = writable(null);

    onMount(async () => {
        await fetchPassTypes();
    });

    async function fetchPassTypes() {
        console.log('testing from request')
        try {
            const storedToken = localStorage.getItem('token');
            let token = JSON.parse(storedToken);

            const response = await fetch(`https://egp-broker.cs.vt.edu/egp-broker-service/api/pass-types/`, {
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
            error = 'An error occurred while fetching pass types.';
        }
    }

    async function submitFreePassRequest() {
        try {
            const storedToken = localStorage.getItem('token');
            let token = JSON.parse(storedToken);

            let courseOfferingId = $course.courseOfferingId._id;
            let selectedPassTypeId = $passTypeId;  // Use the value from the writable store

            console.log("Token to be sent: ", token.access_token);  // Log token for debugging

            const response = await fetch('https://egp-broker.cs.vt.edu/egp-broker-service/api/freepassrequest', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token.access_token}`
                },
                body: JSON.stringify({ reason, courseOfferingId, passTypeId: selectedPassTypeId })
            });

            if (response.ok) {
                const result = await response.json();
                success = 'Free pass request sent successfully!';
                error = '';
            } else {
                const errorData = await response.json();
                error = errorData.error;
                console.log("Error response from server: ", error);  // Log error response
            }
        } catch (err) {
            error = err.message;
            console.log("Error in fetch: ", err);  // Log fetch error
        }
    }
</script>

<Master>
    <form class="mt-5 form-group" on:submit|preventDefault={submitFreePassRequest}>
        <div class="input-group-append">
            <label for="">Pass Type</label>
            <select required class="form-control" name="passType" bind:value={$passTypeId}>
                {#each passTypes as passType}
                    <option value={passType._id}>{passType.name}</option>
                {/each}
            </select>
        </div>
        <input
                placeholder="Please enter a reason for free pass"
                class="form-control mt-2"
                type="text"
                id="reason"
                bind:value={reason}
                required
        />

        <div class="input-group-append mt-2">
            <button class="btn btn-primary" type="submit">Request Free Pass</button>
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
