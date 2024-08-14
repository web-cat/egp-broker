<script>
    import { onMount } from 'svelte';
    import { token } from '../../stores';
    import Master from '../../layouts/Master.svelte';

    let passUsages = [];
    let error = '';

    onMount(async () => {
        await fetchPassUsage();
    });

    async function fetchPassUsage() {
        try {
            const storedToken = localStorage.getItem('token');
            const token = JSON.parse(storedToken);

            const response = await fetch('https://egp-broker.cs.vt.edu/egp-broker-service/api/pass-usage-history', {
                headers: {
                    Authorization: `Bearer ${token.access_token}`
                }
            });

            if (response.ok) {
                passUsages = await response.json();
            } else {
                error = 'Error fetching pass usage history';
            }
        } catch (err) {
            error = 'An error occurred while fetching pass usage history';
        }
    }
</script>

<Master>
    <h1>Pass Usage History</h1>

    {#if error}
        <p class="error">{error}</p>
    {/if}

    {#if passUsages.length > 0}
        <div class="responsive-table">
        <table class="table table-bordered">
            <thead>
            <tr>
                <th>Pass Type</th>
                <th>Assignment</th>
                <th>Value</th>
                <th>Date Used</th>
            </tr>
            </thead>
            <tbody>
            {#each passUsages as usage}
                <tr>
                    <td>{usage.freePassId?.passTypeId?.name}</td>
                    <td>{usage.assignmentId?.title}</td>
                    <td>{usage.freePassId?.value}</td>
                    <td>{new Date(usage.usedAt).toLocaleString()}</td>
                </tr>
            {/each}
            </tbody>
        </table>
        </div>

    {:else}
        <p>No pass usage history found.</p>
    {/if}
</Master>

<style>
    .responsive-table{
        overflow-x: auto;
    }

</style>