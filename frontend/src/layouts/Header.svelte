<script>
	// Import any necessary functions or stores
	import { isLoading, user, token, course } from '../stores';

	import { goto } from '$app/navigation';

	function logout() {
		goto('/logout');
	}
</script>

<nav class="header">
	<div class="logo">
		<a href="/"> FREE PASS </a>
	</div>
	<ul class="nav-links d-flex align-items-center">
		<li><a href="/home">Home</a></li>
		<li><a href="/home">Course: {$course?.CourseOffering?.Course?.name} ({$course?.role.toUpperCase()})</a></li>
		{#if $course?.role == 'instructor' || $course?.role == 'ta'}
			<li><a href="/students">My Students</a></li>
			<li><a href="/instructor/freepass">Passes</a></li>
			<li><a href="/instructor/requests">Requests</a></li>
			<!-- <li><a href="/instructor/courses">My Courses</a></li> -->
			<!-- <li><a class="dropdown-item" href="/profile">Profile</a></li> -->
			<li><a class="dropdown-item" on:click={() => logout()} href="#">Logout</a></li>
		{:else}
			<li><a href="/student/passes">My Passes</a></li>
			<li><a href="/student/request">Request +</a></li>
			<!-- <li><a href="/student/courses">My Courses</a></li> -->
			<!-- <li><a class="dropdown-item" href="/profile">Profile</a></li> -->
			<li><a class="dropdown-item" on:click={() => logout()} href="#">Logout</a></li>
		{/if}
		<li class="position-relative dropdown">
			<button
				class="bg-transparent border-0"
				type="button"
				data-bs-toggle="dropdown"
				aria-expanded="false"
			>
				<a href="/home" class="d-flex gap-1 profile-sign text-left">
					<img
						style="object-fit: contain;border-radius: 100%"
						src="/images/placeholder.png"
						width="40"
						height="40"
						alt=""
					/>
					<div style="text-align: left">
						<h6 class="m-0 p-0" style="font-size: 0.8rem">
							Welcome, {$user?.name}!
						</h6>
						<p class="m-0 p-0" style="font-size: 0.8rem">{$course?.CourseOffering?.Course?.name} ({$course?.role.toUpperCase()})</p>
					</div>
				</a>
			</button>

			<ul class="dropdown-menu">
				{#if $user}{:else}
					<li><a class="dropdown-item" href="/login">Login</a></li>
				{/if}
			</ul>
		</li>
	</ul>
</nav>

<style>
	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.8rem 2rem;
		background-color: #ffffff;
	}

	.logo {
		height: 3rem;
	}

	.logo a {
		text-decoration: none;
		font-size: 1.5rem;
		font-weight: bold;
	}

	.nav-links {
		list-style: none;
	}

	.nav-links li {
		display: inline;
		margin-left: 20px;
	}

	.nav-links li a {
		text-decoration: none;
		transition: color 0.3s ease-in-out;
	}

	.nav-links li a:hover {
		color: var(--primary-color);
	}
</style>
