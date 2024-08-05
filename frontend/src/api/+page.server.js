// src/routes/api/fetch-assignments.js
import { json } from '@sveltejs/kit';

export async function GET() {
    try {
        const storedToken = 'PjWYxKeZO3lB5oMaoTVqkui3erdFB8HeRKDj5zaO7rDTnw3OtdMymGNq0BiQouLB'
        const response = await fetch('http://192.168.1.68:3091/courses/1/assignments', {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${storedToken}`
            }
        });

        if (response.ok) {
            const assignments = await response.json();
            return json(assignments);
        } else {
            const errorData = await response.json();
            return json({ error: errorData.error }, { status: response.status });
        }
    } catch (err) {
        return json({ error: 'An error occurred while fetching assignments.' }, { status: 500 });
    }
}
