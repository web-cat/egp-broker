// src/stores.js
import { writable } from 'svelte/store';

export const isLoading = writable(false);
export const user = writable(null);
export const course = writable(null);
export const token = writable(null);
export const passes = writable([]);
export const selectedPassId = writable(null);