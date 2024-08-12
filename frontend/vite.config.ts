import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		host: '0.0.0.0',  // Bind to all network interfaces
		port: 3000        // Set the port to 3000
	}
});
