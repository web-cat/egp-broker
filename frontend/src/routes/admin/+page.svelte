<script>
    import { onMount } from 'svelte';
    import 'bootstrap/dist/css/bootstrap.min.css';
    import '/src/styles/global.css';

    let tools = [];
    let newTool = {
        toolId: '',
        clientId: '',
        clientSecret: '',
        publicKey: '',
        privateKey: '',
        grants: []
    };
    let editTool = null;
    let error = '';
    let isLoading = false;
    let token = '';
    let grantsString = ''; // Add this

    const getTokenFromLocalStorage = () => {
        const storedToken = localStorage.getItem('token');
        return storedToken ? JSON.parse(storedToken).access_token : '';
    };

    const fetchTools = async () => {
        isLoading = true;
        token = getTokenFromLocalStorage();
        try {
            const response = await fetch('https://egp-broker.cs.vt.edu/egp-broker-service/api/tool', {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            if (response.ok) {
                tools = await response.json();
            } else {
                const data = await response.json();
                error = data.error || 'Failed to fetch tools.';
            }
        } catch (err) {
            console.error(err);
            error = 'An error occurred while fetching tools.';
        } finally {
            isLoading = false;
        }
    };

    const addTool = async (e) => {
        e.preventDefault();
        isLoading = true;
        token = getTokenFromLocalStorage();
        try {
            // Update the newTool object with grants from grantsString
            newTool.grants = grantsString.split(',').map(grant => grant.trim());
            const response = await fetch('https://egp-broker.cs.vt.edu/egp-broker-service/api/tool', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(newTool),
            });
            if (response.ok) {
                const tool = await response.json();
                tools = [...tools, tool];
                newTool = { toolId: '', clientId: '', clientSecret: '', publicKey: '', privateKey: '', grants: [] };
                grantsString = ''; // Clear grantsString
            } else {
                const data = await response.json();
                error = data.error || 'Failed to add tool.';
            }
        } catch (err) {
            console.error(err);
            error = 'An error occurred while adding the tool.';
        } finally {
            isLoading = false;
        }
    };

    const updateTool = async (e) => {
        e.preventDefault();
        isLoading = true;
        token = getTokenFromLocalStorage();
        try {
            // Update the editTool object with grants from grantsString
            editTool.grants = grantsString.split(',').map(grant => grant.trim());
            const response = await fetch(`https://egp-broker.cs.vt.edu/egp-broker-service/api/tool/${editTool._id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(editTool),
            });
            if (response.ok) {
                const updatedTool = await response.json();
                tools = tools.map(tool => tool._id === updatedTool._id ? updatedTool : tool);
                editTool = null;
                grantsString = ''; // Clear grantsString
            } else {
                const data = await response.json();
                error = data.error || 'Failed to update tool.';
            }
        } catch (err) {
            console.error(err);
            error = 'An error occurred while updating the tool.';
        } finally {
            isLoading = false;
        }
    };

    const deleteTool = async (toolId) => {
        isLoading = true;
        token = getTokenFromLocalStorage();
        try {
            const response = await fetch(`https://egp-broker.cs.vt.edu/egp-broker-service/api/tool/${toolId}`, {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            if (response.ok) {
                tools = tools.filter(tool => tool._id !== toolId);
            } else {
                const data = await response.json();
                error = data.error || 'Failed to delete tool.';
            }
        } catch (err) {
            console.error(err);
            error = 'An error occurred while deleting the tool.';
        } finally {
            isLoading = false;
        }
    };

    const generateToolId = () => {
        const uniqueId = `tool_${Math.random().toString(36).substr(2, 9)}`;
        newTool.toolId = uniqueId;
    };

    const generateClientId = () => {
        const uniqueClientId = `client_${Math.random().toString(36).substr(2, 9)}`;
        newTool.clientId = uniqueClientId;
    };

    const generateClientSecret = () => {
        const uniqueClientSecret = `secret_${Math.random().toString(36).substr(2, 12)}`;
        newTool.clientSecret = uniqueClientSecret;
    };

    const handleEditTool = (tool) => {
        editTool = { ...tool };
        grantsString = editTool.grants.join(', ');
    };

    const closeModal = () => {
        editTool = null;
    };

    const logout = () => {
        localStorage.clear();
        window.location.href = '/';
    };

    onMount(fetchTools);
</script>

<main class="container">
    <div class="d-flex">
        <h1>Admin Dashboard</h1>
        <a on:click={logout}>Logout</a>
    </div>
    <!-- Add Tool Form -->
    <h2>Add Tool</h2>

    <form on:submit={addTool}>
        <div class="form-grid mb-4">
            <div class="form-item left id_class">
                <label for="toolId" class="form-label">Tool ID</label>
                <input type="text" id="toolId" bind:value={newTool.toolId} class="form-control" required />
                <button type="button" class="generate-id btn btn-secondary" on:click={generateToolId}>Generate ID</button>
            </div>
            <div class="form-item right">
                <label for="clientId" class="form-label">Client ID</label>
                <input type="text" id="clientId" bind:value={newTool.clientId} class="form-control" required />
                <button type="button" class="generate-id btn btn-secondary" on:click={generateClientId}>Generate Client ID</button>
            </div>
            <div class="form-item left">
                <label for="clientSecret" class="form-label">Client Secret</label>
                <input type="text" id="clientSecret" bind:value={newTool.clientSecret} class="form-control" required />
                <button type="button" class="generate-id btn btn-secondary" on:click={generateClientSecret}>Generate Client Secret</button>
            </div>
            <div class="form-item right">
                <label for="publicKey" class="form-label">Public Key</label>
                <input type="text" id="publicKey" bind:value={newTool.publicKey} class="form-control" />
            </div>
            <div class="form-item left">
                <label for="privateKey" class="form-label">Private Key</label>
                <input type="text" id="privateKey" bind:value={newTool.privateKey} class="form-control" />
            </div>
            <div class="form-item right">
                <label for="grants" class="form-label">Grants</label>
                <input type="text" id="grants" bind:value={grantsString} class="form-control" placeholder="Comma separated values" />
            </div>
        </div>
        {#if error}
            <div class="alert alert-danger" role="alert">{error}</div>
        {/if}
        <button type="submit" class="btn btn-primary" disabled={isLoading}>
            {#if isLoading}
                Adding...
            {:else}
                Add Tool
            {/if}
        </button>
    </form>

    <!-- Tool List -->
    <h2 class="pt-12">Tool List</h2>
    {#if isLoading}
        <p>Loading...</p>
    {:else}
        <table class="table">
            <thead>
            <tr>
                <th>Tool ID</th>
                <th>Client ID</th>
                <th>Client Secret</th>
                <th>Public Key</th>
                <th>Private Key</th>
                <th>Grants</th>
                <th>Actions</th>
            </tr>
            </thead>
            <tbody>
            {#each tools as tool}
                <tr>
                    <td>{tool.toolId}</td>
                    <td>{tool.clientId}</td>
                    <td>{tool.clientSecret}</td>
                    <td>{tool.publicKey}</td>
                    <td>{tool.privateKey}</td>
                    <td>{tool.grants.join(', ')}</td>
                    <td>
                        <button class="btn btn-secondary" on:click={() => handleEditTool(tool)}>Edit</button>
                        <button class="btn btn-danger" on:click={() => deleteTool(tool._id)}>Delete</button>
                    </td>
                </tr>
            {/each}
            </tbody>
        </table>
    {/if}

    <!-- Edit Tool Modal -->
    <!-- Edit Tool Modal -->
    {#if editTool}
        <div class="modal" tabindex="-1" role="dialog">
            <div class="modal-dialog" role="document">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Edit Tool</h5>
                        <button type="button" class="close" aria-label="Close" on:click={closeModal}>
                            <span aria-hidden="true">&times;</span>
                        </button>
                    </div>
                    <form on:submit={updateTool}>
                        <div class="modal-body">
                            <div class="form-grid mb-4">
                                <div class="form-item left">
                                    <label for="toolId" class="form-label">Tool ID</label>
                                    <input type="text" id="toolId" bind:value={editTool.toolId} class="form-control" required />
                                </div>
                                <div class="form-item right">
                                    <label for="clientId" class="form-label">Client ID</label>
                                    <input type="text" id="clientId" bind:value={editTool.clientId} class="form-control" required />
                                </div>
                                <div class="form-item left">
                                    <label for="clientSecret" class="form-label">Client Secret</label>
                                    <input type="text" id="clientSecret" bind:value={editTool.clientSecret} class="form-control" required />
                                </div>
                                <div class="form-item right">
                                    <label for="publicKey" class="form-label">Public Key</label>
                                    <input type="text" id="publicKey" bind:value={editTool.publicKey} class="form-control" />
                                </div>
                                <div class="form-item left">
                                    <label for="privateKey" class="form-label">Private Key</label>
                                    <input type="text" id="privateKey" bind:value={editTool.privateKey} class="form-control" />
                                </div>
                                <div class="form-item right">
                                    <label for="grants" class="form-label">Grants</label>
                                    <input type="text" id="grants" bind:value={grantsString} class="form-control" placeholder="Comma separated values" />
                                </div>
                            </div>
                            {#if error}
                                <div class="alert alert-danger" role="alert">{error}</div>
                            {/if}
                        </div>
                        <div class="modal-footer">
                            <button type="submit" class="btn btn-primary" disabled={isLoading}>
                                {#if isLoading}
                                    Updating...
                                {:else}
                                    Update Tool
                                {/if}
                            </button>
                            <button type="button" class="btn btn-secondary" on:click={closeModal}>Close</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    {/if}

</main>

<style>
    .d-flex{
        justify-content: space-between;
        align-items: center;
        cursor: pointer;
    }
    .form-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
    }

    .form-item {
        margin-bottom: 1rem;
    }

    .form-item.left {
        grid-column: 1 / 2;
    }

    .form-item.right {
        grid-column: 2 / 3;
    }

    .modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.5); /* Overlay background */
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1050; /* Make sure the modal is on top of other content */
    }
    .modal-dialog {
        width: 90%;
        max-width: 600px; /* Adjust as needed */
        margin: 0;
    }
    .modal-content {
        background-color: #fff;
        border-radius: 0.3rem;
        box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.075);
        position: relative;
    }


    .form-item{
        position: relative;
    }
    .generate-id{
        position: absolute;
        right: 0;
        bottom: 1px;
        background-color: #0D2A49 !important;
        color: white !important;
    }
</style>
