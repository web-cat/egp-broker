<script>
    import Master from '../../layouts/Master.svelte';
    import { course, user } from '../../stores';
    import { onMount } from 'svelte';

    let userProfile;
    let courses = [];

    onMount(async () => {
        user.subscribe((value) => {
            userProfile = value;
        });

        await fetchcourses();
    });

    async function fetchcourses() {
        try {
            const storedToken = localStorage.getItem('token');
            let token = JSON.parse(storedToken);

            const response = await fetch('https://egp-broker.cs.vt.edu/egp-broker-service/api/courses', {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${token.access_token}`
                }
            });

            if (response.ok) {
                courses = await response.json();

                if ($course == null) {
                    if (courses.length > 0) setDefault(courses[0]);
                }
            } else {
                const errorData = await response.json();
                error = errorData.error;
            }
        } catch (err) {
            error = 'An error occurred while fetching courses.';
        }
    }

    function setDefault(c) {
        localStorage.setItem('course', JSON.stringify(c));
        course.set(c);
    }
</script>

<Master>
    <h1>Welcome, {userProfile?.name}</h1>
    <p>This is the common home page.</p>

    <div class="table-responsive">
        <table class="table table-bordered">
            <thead>
            <tr>
                <th>Course</th>
                <th>Role</th>
                <th>Action</th>
            </tr>
            </thead>
            <tbody>
            {#each courses as c}
                <tr>
                    <td>
                        {c.courseOfferingId.courseId.name} | {c.courseOfferingId.termId.name}
                    </td>
                    <td>
                        {c.role}
                    </td>
                    <td>
                        {#if $course?._id === c._id}
                            <p>Default</p>
                        {:else}
                            <button
                                    class="btn btn-sm btn-danger"
                                    on:click={() => {
										setDefault(c);
									}}>Set As Default</button
                            >
                        {/if}
                    </td>
                </tr>
            {/each}
            </tbody>
        </table>
    </div>
</Master>

<style>
    .table-responsive {
        width: 100%;
        overflow-x: auto;
    }

    .table {
        width: 100%;
    }

    @media (max-width: 768px) {
        .table {
            display: block;
            overflow-x: auto;
            white-space: nowrap;
        }

        th, td {
            white-space: nowrap;
        }
    }
</style>
