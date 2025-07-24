"use client";
import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getLtik } from "@/lib/ltik";
import ky from 'ky';

//tool connection and configuration page - WIP
export default function ToolConfig() {
    console.log("HELLO");
    const router = useRouter();
    const [contentHtml, setContentHtml] = React.useState('');
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);

    useEffect(() => {
    async function fetchOpenDSAContent() {
        try {
            // Make the request to your backend's new OpenDSA content proxy endpoint
            const response = await ky.get(`/api/proxy/opendsa-content`, {
                credentials: "include",
                headers: { Authorization: "Bearer " + getLtik() },
            })
            .json();
            setContentHtml(response);
            console.log("Course Info:", response);

            // The response is expected to be HTML, so get it as text
            //const html = await response.text();
            //setContentHtml(html);

        } catch (err) {
            console.error("Error fetching OpenDSA content:", err);
            //console.log("Error fetching OpenDSA content:", err);
            setError("Failed to load OpenDSA content. Please try again later.");
            // If the error message is too generic, you might parse err.response.text()
            // if ky provides it, to show more specific backend error messages.
        } finally {
            setLoading(false);
        }
    };

    fetchOpenDSAContent();
    }, []); // Empty dependency array means this runs once on component mount

    if (loading) {
        return (
        <div className="container mx-auto p-6">
            <h1 className="text-3xl font-bold mb-4">Loading OpenDSA Content...</h1>
            <p>Please wait while we fetch the content from OpenDSA.</p>
        </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-4">
            <h1 className="text-4xl font-bold mb-6 text-green-700">Welcome to Your New Section!</h1>
            {/* Add your new content, components, forms, etc. here */}
            <div className="mt-8">
                <Button onClick={() => router.push('/')}>
                Back to Welcome
                </Button>
            </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6">
        <Link href="/" className="text-blue-600 hover:underline mb-4 block">Back to Home</Link>
        <h1 className="text-3xl font-bold mb-4">OpenDSA Content</h1>
        {/* WARNING: dangerouslySetInnerHTML is named dangerous for a reason.
            Only use it with HTML content you trust. OpenDSA's content should be fine,
            but be aware of potential XSS risks if you were to load untrusted HTML.
        */}
        <div dangerouslySetInnerHTML={{ __html: contentHtml }} />
        </div>
    );
}

  