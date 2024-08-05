export async function load({ fetch }) {
    try {
        const accessToken = 'PjWYxKeZO3lB5oMaoTVqkui3erdFB8HeRKDj5zaO7rDTnw3OtdMymGNq0BiQouLB'; // Replace with actual token fetching logic
        const courseId = '1';

        const response = await fetch(`http://192.168.1.68:3091/api/v1/courses/${courseId}/assignments`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });

        console.log('responseing:', response)
        if (response.ok) {
            const assignments = await response.json(); // The assignments are already an array
            return {assignments};
        } else {
            const errorData = await response.json();
            throw errorData.error;
        }
    } catch (err) {
        console.error('Error fetching assignments:', err);
        throw new Error('An error occurred while fetching assignments.');
    }
}