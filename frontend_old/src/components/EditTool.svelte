<script>
    export let showModal = false;
    export let closeModal = () => {};
</script>

{#if showModal}
    <div class="modal-overlay" on:click={closeModal}>
        <div class="modal-content" on:click|stopPropagation>
            <slot></slot>
            <button class="close-btn" on:click={closeModal}>Close</button>
        </div>
    </div>
{/if}

<style>
    .modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    }
    .modal-content {
        background: white;
        padding: 1em;
        border-radius: 5px;
        width: 80%;
        max-width: 500px;
    }
    .close-btn {
        background: red;
        color: white;
        border: none;
        padding: 0.5em;
        border-radius: 5px;
        cursor: pointer;
        float: right;
    }
</style>
