/**
 * Helper function to get appropriate authentication headers
 * for both LTI and session-based authentication
 */
export const getAuthHeaders = () => {
    try {
        const searchParams = new URLSearchParams(window.location.search);
        const ltik = searchParams.get("ltik");

        if (ltik) {
            // LTI authentication - include Bearer token
            return { Authorization: "Bearer " + ltik }
        }
    } catch (error) {
        console.log("No ltik found, using session auth");
    }

    // Session authentication - return empty headers
    return {};
};

/**
 * Returns null if ltik is not present (session auth)
 */
export const getLtik = () => {
    const searchParams = new URLSearchParams(window.location.search);
    return searchParams.get("ltik") || null;
};