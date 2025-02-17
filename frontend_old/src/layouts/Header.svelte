<script>
	import { isLoading, user, token, course } from '../stores';
	import { goto } from '$app/navigation';

	let menuOpen = false;

	function toggleMenu() {
		menuOpen = !menuOpen;
	}

	function logout() {
		goto('/logout');
	}
</script>

<nav class="header">
	<div class="logo">
		<a href="/">FREE PASS</a>
	</div>
	<button class="menu-toggle" aria-label="Toggle navigation" on:click={toggleMenu}>
		&#9776;
	</button>
	<div class:open={menuOpen} class="nav-links">
		<ul>
			<li><a href="/home">Home</a></li>
			<li><a href="/home">Course: {$course?.courseOfferingId?.courseId?.name} ({$course?.role.toUpperCase()})</a></li>
			{#if $course?.role == 'instructor' || $course?.role == 'ta'}
				<li><a href="/students">My Students</a></li>
				<li><a href="/assignments">Assignments</a></li>
				<li><a href="/requests">Requests</a></li>
				<li><a on:click={logout} href="#">Logout</a></li>
			{:else}
				<li><a href="/student/passes">My Passes</a></li>
				<li><a href="/student/request">Request +</a></li>
				<li><a href="/student-requests">Requests</a></li>
				<li><a href="/student-assignments">Assignments</a></li>
				<li><a href="/pass-history">History</a></li>

				<li><a on:click={logout} href="#">Logout</a></li>
			{/if}
		</ul>
	</div>
</nav>

<style>
	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.8rem 2rem;
		background-color: #ffffff;
		position: relative;
		z-index: 1;
	}

	.logo a {
		text-decoration: none;
		font-size: 1.5rem;
		font-weight: bold;
	}

	.menu-toggle {
		display: none;
		background: none;
		border: none;
		font-size: 1.5rem;
		cursor: pointer;
	}

	.nav-links {
		display: flex;
		align-items: center;
	}

	.nav-links ul {
		display: flex;
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.nav-links ul li {
		margin-left: 20px;
	}

	.nav-links ul li a {
		text-decoration: none;
		transition: color 0.3s ease-in-out;
	}

	.nav-links ul li a:hover {
		color: var(--primary-color);
	}

	@media (max-width: 768px) {
		.nav-links {
			display: none;
			flex-direction: column;
			align-items: flex-start;
			background: #fff;
			width: 100%;
			border-top: 1px solid #ddd;
			position: fixed;
			top: 9%; /* Push below the navbar */
			left: 0;
			z-index: 0;
		}

		.nav-links.open {
			display: flex;
		}

		.nav-links ul {
			flex-direction: column;
			width: 100%;
		}

		.nav-links ul li {
			margin: 0;
			width: 100%;
			text-align: left;
			border-bottom: 1px solid #ddd;
		}

		.nav-links ul li a {
			display: block;
			width: 100%;
			padding: 10px 20px;
		}

		.menu-toggle {
			display: block;
		}
	}
</style>
