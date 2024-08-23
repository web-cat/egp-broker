// src/lib/auth.js

import { goto } from '$app/navigation';

// Function to get the user role from local storage
const getUserRole = () => {
  const storedUser = localStorage.getItem('user');
  if (storedUser) {
    const user = JSON.parse(storedUser);
    return user.role;
  }
  return null;
};

// Function to protect routes based on role
export const protectRoute = (path) => {
  const userRole = getUserRole();
  
  if (path === '/admin' && userRole !== 'admin') {
    goto('/unauthorized'); // Redirect to unauthorized page
  }
};
