
"use client";
import React, { useEffect, useState} from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getLtik } from "@/lib/ltik";
import ky from 'ky';
import Link from 'next/link';
import { 
    Card,
    CardContent,
    CardDescription, 
    CardHeader, 
    CardTitle 
} from "@/components/ui/card";
//tool options
const TOOL_OPTIONS = [
  //{ value: "", label: "Select a tool" },
  { value: "opendsa", label: "OpenDSA" },
  // Add other tools here
];
//tool connection and configuration page - WIP
export default function ToolConfig() {
    const router = useRouter();
    const [ltik, setLtik] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedTool, setSelectedTool] = useState("");
    const [configStatus, setConfigStatus] = useState({ message: '', type: '' });
    const [openDSAConfig, setOpenDSAConfig] = useState({
        // These would be pre-filled or configured via the backend
        ltiConsumerKey: "",
        ltiSharedSecret: "",
        ltiLaunchUrl: ""
    });
    useEffect (() => {
        const fetchLtikAndConfig = async () => {
            //get ltik and store
            setIsLoading(true);
            const key = getLtik();
            setLtik(key);
            if (key) {
                try {
                    //get request to backend api to get config info
                    const response = await ky.get('/api/tool-config', {
                        headers: {
                            'Authorization': `Bearer ${key}`,
                        },
                        timeout: 10000
                    }).json();
                    if (response.success && response.config) {
                        setOpenDSAConfig(response.config);
                        setConfigStatus({ message: 'Existing configuration loaded from MongoDB.', type: 'success' });
                        setSelectedTool("opendsa");
                    } else {
                        setConfigStatus({ message: 'No existing configuration found. Please enter details.', type: 'info' });
                    }
                } catch (error) {
                    console.error("Error fetching config:", error);
                    setConfigStatus({ message: `Error fetching configuration from backend: ${error.message}`, type: 'error' });
                }
            } else {
                setConfigStatus({ message: "Authentication required. Please launch from LMS.", type: 'error' });
            }
            setIsLoading(false);
        };
        fetchLtikAndConfig();
    }, []);

    const handleToolSelect = (value) => {
        setSelectedTool(value);
        setConfigStatus({ message: '', type: '' });
    };

    const handleConfigure = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setConfigStatus({ message: '', type: '' });

        if (!ltik) {
            setConfigStatus({ message: "Authentication required (LTI Key missing). Please launch from LMS.", type: 'error' });
            setIsLoading(false);
            return;
        }

        if (!selectedTool) {
            setConfigStatus({ message: "Please select a tool to configure.", type: 'error' });
            setIsLoading(false);
            return;
        }

        try {
        const response = await ky.post('/api/tool-config', {
            json: {
            toolType: selectedTool,
            ltiConfig: openDSAConfig
            // You could include additional form data if needed for specific tools
            // e.g., OpenDSA's specific book path or module IDs if they are configured per instance
            },
            headers: {
            'Authorization': `Bearer ${ltik}`,
            'Content-Type': 'application/json',
            },
            timeout: 10000 // 10 seconds timeout
        }).json();

        if (response.success) {
            setConfigStatus({ message: `Successfully configured ${selectedTool}.`, type: 'success' });
            // Optionally, redirect after successful configuration
            // router.push('/');
        } else {
            setConfigStatus({ message: response.error || `Failed to configure ${selectedTool}.`, type: 'error' });
        }

        } catch (error) {
            console.error("Configuration error:", error);
            setConfigStatus({ message: `An unexpected error occurred during configuration: ${error.message}`, type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    // Show a loading spinner while the LTI key is being fetched
    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <p>Loading...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-50">
        <Card className="w-full max-w-md p-6 shadow-lg rounded-lg">
            <CardHeader>
            <CardTitle className="text-2xl font-bold text-center">LTI Tool Configuration</CardTitle>
            <CardDescription className="text-center text-gray-600">
                Select a tool to configure its LTI connection.
            </CardDescription>
            </CardHeader>
            <CardContent>
            {!ltik && (
                <div className="text-red-500 mb-4 text-center">
                {configStatus.message || "Authentication required. Please launch from LMS."}
                </div>
            )}

            <form onSubmit={handleConfigure} className="space-y-6">
                <div className="grid gap-2">
                <Label htmlFor="tool-select">Select Tool</Label>
                <Select onValueChange={handleToolSelect} value={selectedTool}>
                    <SelectTrigger id="tool-select" className="w-full">
                    <SelectValue placeholder="Select a tool" />
                    </SelectTrigger>
                    <SelectContent>
                    {TOOL_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                        {option.label}
                        </SelectItem>
                    ))}
                    </SelectContent>
                </Select>
                </div>

                {selectedTool === "opendsa" && (
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold border-b pb-2">OpenDSA LTI 1.1 Credentials</h3>
                        <div className="grid gap-2">
                            <Label htmlFor="ltiConsumerKey">LTI 1.1 Consumer Key</Label>
                            <Input
                                id="ltiConsumerKey"
                                value={openDSAConfig.ltiConsumerKey}
                                onChange={(e) => setOpenDSAConfig({...openDSAConfig, ltiConsumerKey: e.target.value})}
                                placeholder="Enter Consumer Key"
                                required
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="ltiSharedSecret">LTI 1.1 Shared Secret</Label>
                            <Input
                                id="ltiSharedSecret"
                                value={openDSAConfig.ltiSharedSecret}
                                onChange={(e) => setOpenDSAConfig({...openDSAConfig, ltiSharedSecret: e.target.value})}
                                placeholder="Enter Shared Secret"
                                required
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="ltiLaunchUrl">LTI 1.1 Launch URL</Label>
                            <Input
                                id="ltiLaunchUrl"
                                value={openDSAConfig.ltiLaunchUrl}
                                onChange={(e) => setOpenDSAConfig({...openDSAConfig, ltiLaunchUrl: e.target.value})}
                                placeholder="Enter Launch URL"
                                required
                            />
                        </div>
                    </div>
                )}

                {configStatus.message && (
                <div className={`p-3 rounded-md text-center text-sm ${
                    configStatus.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                    {configStatus.message}
                </div>
                )}

                <Button type="submit" className="w-full" disabled={isLoading || !ltik || !selectedTool}>
                {isLoading ? "Configuring..." : "Configure Tool"}
                </Button>
            </form>

            <div className="mt-6 text-center">
                <Link href="/" className="text-blue-600 hover:underline">
                Back to Home
                </Link>
            </div>
            </CardContent>
        </Card>
        </div>
    );
}

  