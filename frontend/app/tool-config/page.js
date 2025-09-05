
"use client";
import React, { useCallback, useEffect, useState} from "react";
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

// LTI version options
const LTI_VERSION_OPTIONS = [
  { value: "1.1", label: "LTI 1.1" },
  { value: "1.3", label: "LTI 1.3" },
];

//tool options
const TOOL_OPTIONS_11 = [
  { value: "opendsa11", label: "OpenDSA 1.1" },
  { value: "other", label: "Other" },
  // Add other tools here
];
const TOOL_OPTIONS_13 = [
    { value: "opendsa13", label: "OpenDSA 1.3" },
]

const TOOL_OPTIONS = {
  "1.1": [{ value: "opendsa11", label: "OpenDSA 1.1" }, { value: "other", label: "Other" }],
  "1.3": [{ value: "opendsa13", label: "OpenDSA 1.3" }],
};

const initialToolConfig = {
    ltiConsumerKey: "",
    ltiSharedSecret: "",
    ltiLaunchUrl: "",
    lti13ClientId: "",
    lti13OpenIdConnectUrl: "",
    lti13ToolJwkUrl: ""
};

//tool connection and configuration page - WIP
export default function ToolConfig() {
    const router = useRouter();
    const [ltik, setLtik] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedLtiVersion, setSelectedLtiVersion] = useState("");
    const [selectedTool, setSelectedTool] = useState("");
    const [toolConfigs, setToolConfigs] = useState({});
    const [configStatus, setConfigStatus] = useState({ message: '', type: '' });
    const [toolConfig, setToolConfig] = useState(initialToolConfig);

    
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
                        setToolConfig(response.config);
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

    const handleLtiVersionSelect = (value) => {
        setSelectedLtiVersion(value);
        setConfigStatus({ message: '', type: '' });
    };

    const handleToolSelect = (value) => {
        setSelectedTool(value);
        setConfigStatus({ message: "", type: "" });
    };

    const handleConfigChange = (e, field) => {
        const value = e.target.value;
        setToolConfig(prev => ({ ...prev, [field]: value }));
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

        if (!selectedLtiVersion) {
            setConfigStatus({ message: "Please select an LTI version.", type: 'error' });
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
            ltiVersion: selectedLtiVersion,
            ltiConfig: toolConfig
            },
            headers: {
            'Authorization': `Bearer ${ltik}`,
            'Content-Type': 'application/json',
            },
            timeout: 10000 // 10 seconds timeout
        }).json();

        if (response.success) {
            setConfigStatus({ message: `Successfully configured ${selectedTool}.`, type: 'success' });
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

    const availableTools = TOOL_OPTIONS[selectedLtiVersion] || [];
    // const availableTools = selectedLtiVersion === "1.1"
    // ? TOOL_OPTIONS_11
    // : selectedLtiVersion === "1.3"
    // ? TOOL_OPTIONS_13
    // : [];

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
                <Label htmlFor="lti-version-select">Select LTI Version</Label>
                <Select onValueChange={handleLtiVersionSelect} value={selectedLtiVersion}>
                    <SelectTrigger id="lti-version-select" className="w-full">
                    <SelectValue placeholder="Select an LTI version" />
                    </SelectTrigger>
                    <SelectContent>
                    {LTI_VERSION_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                        {option.label}
                        </SelectItem>
                    ))}
                    </SelectContent>
                </Select>
                </div>
                {selectedLtiVersion && (
                    <div className="grid gap-2">
                    <Label htmlFor="tool-select">Select Tool</Label>
                    <Select onValueChange={handleToolSelect} value={selectedTool}>
                        <SelectTrigger id="tool-select" className="w-full">
                        <SelectValue placeholder="Select a tool" />
                        </SelectTrigger>
                        <SelectContent>
                        {availableTools.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                            {option.label}
                            </SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                    </div>
                )}

                {selectedTool && selectedLtiVersion === "1.1" && (
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold border-b pb-2">LTI 1.1 Credentials for {selectedTool}</h3>
                        <div className="grid gap-2">
                            <Label htmlFor="ltiConsumerKey">LTI 1.1 Consumer Key</Label>
                            <Input
                                id="ltiConsumerKey"
                                value={toolConfig.ltiConsumerKey || ''}
                                onChange={(e) => handleConfigChange(e, 'ltiConsumerKey')}
                                placeholder="Enter Consumer Key"
                                required
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="ltiSharedSecret">LTI 1.1 Shared Secret</Label>
                            <Input
                                id="ltiSharedSecret"
                                value={toolConfig.ltiSharedSecret || ''}
                                onChange={(e) => handleConfigChange(e, 'ltiSharedSecret')}
                                placeholder="Enter Shared Secret"
                                required
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="ltiLaunchUrl">LTI 1.1 Launch URL</Label>
                            <Input
                                id="ltiLaunchUrl"
                                value={toolConfig.ltiLaunchUrl || ''}
                                onChange={(e) => handleConfigChange(e, 'ltiLaunchUrl')}
                                placeholder="Enter Launch URL"
                                required
                            />
                        </div>
                    </div>
                )}

                {selectedTool && selectedLtiVersion === "1.3" && (
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold border-b pb-2">LTI 1.3 Credentials for {selectedTool}</h3>
                        <div className="grid gap-2">
                            <Label htmlFor="lti13ClientId">Client ID</Label>
                            <Input
                                id="lti13ClientId"
                                value={toolConfig.lti13ClientId || ''}
                                onChange={(e) => handleConfigChange(e, 'lti13ClientId')}
                                placeholder="Enter Client ID"
                                required
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="lti13OpenIdConnectUrl">OpenID Connect Launch URL</Label>
                            <Input
                                id="lti13OpenIdConnectUrl"
                                value={toolConfig.lti13OpenIdConnectUrl || ''}
                                onChange={(e) => handleConfigChange(e, 'lti13OpenIdConnectUrl')}
                                placeholder="Enter OpenID Connect Launch URL"
                                required
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="lti13ToolJwkUrl">Public Key (JWK) URL</Label>
                            <Input
                                id="lti13ToolJwkUrl"
                                value={toolConfig.lti13ToolJwkUrl || ''}
                                onChange={(e) => handleConfigChange(e, 'lti13ToolJwkUrl')}
                                placeholder="Enter Public Key URL"
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

                <Button type="advanced" className="w-full" disabled={isLoading || !ltik || !selectedTool}>
                {isLoading ? "Configuring..." : "Advanced Settings"}
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

  