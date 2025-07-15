"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Settings, 
  Key, 
  Eye, 
  EyeOff, 
  Save, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw,
  Shield,
  Info
} from "lucide-react";
import { getLtik } from "@/lib/ltik";
import ky from "ky";

export default function InstructorSettings({ instructorCanvasId }) {
  const [currentApiKey, setCurrentApiKey] = useState("");
  const [newApiKey, setNewApiKey] = useState("");
  const [showNewKey, setShowNewKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [isValidKey, setIsValidKey] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [hasApiKey, setHasApiKey] = useState(false);

  useEffect(() => {
    fetchCurrentApiKey();
  }, [instructorCanvasId]);

  const fetchCurrentApiKey = async () => {
    if (!instructorCanvasId) return;
    
    try {
      setLoading(true);
      const response = await ky.get(`/api/instructor/${instructorCanvasId}/api-key`, {
        credentials: "include",
        headers: { Authorization: "Bearer " + getLtik() },
      }).json();
      
      setHasApiKey(response.hasApiKey);
      setLastUpdated(response.lastUpdated);
      if (response.hasApiKey) {
        setIsValidKey(true);
      }
    } catch (error) {
      console.error("Error fetching API key:", error);
      setMessage({ type: "error", text: "Failed to fetch current API key" });
    } finally {
      setLoading(false);
    }
  };

  const validateApiKey = (key) => {
    if (!key) return false;
    
    // Basic Canvas API key validation (minimum length)
    const isValid = key.length >= 20;
    setIsValidKey(isValid);
    return isValid;
  };

  const handleNewKeyChange = (value) => {
    setNewApiKey(value);
    validateApiKey(value);
  };

  const testNewApiKey = async () => {
    if (!newApiKey || !validateApiKey(newApiKey)) {
      setMessage({ type: "error", text: "Please enter a valid Canvas API key first" });
      return;
    }

    try {
      setTesting(true);
      setMessage({ type: "", text: "" });

      // Test the new API key by making a simple Canvas API call
      const response = await ky.post(`/api/instructor/${instructorCanvasId}/test-new-api-key`, {
        json: { canvasApiKey: newApiKey },
        credentials: "include",
        headers: { Authorization: "Bearer " + getLtik() },
      }).json();

      if (response.valid) {
        setMessage({ type: "success", text: "API key test successful! You can now save it." });
        return true;
      } else {
        setMessage({ type: "error", text: response.message || "API key test failed" });
        return false;
      }

    } catch (error) {
      console.error("Error testing API key:", error);
      setMessage({ type: "error", text: "Failed to test API key. Please check your key and try again." });
      return false;
    } finally {
      setTesting(false);
    }
  };

  const saveApiKey = async () => {
    if (!newApiKey || !validateApiKey(newApiKey)) {
      setMessage({ type: "error", text: "Please enter a valid Canvas API key" });
      return;
    }

    // Test the key before saving
    const testResult = await testNewApiKey();
    if (!testResult) {
      return; // Don't save if test fails
    }

    try {
      setSaving(true);
      setMessage({ type: "", text: "" });

      const response = await ky.post("/api/course/save-api-key", {
        json: {
          instructorCanvasId: instructorCanvasId,
          canvasApiKey: newApiKey
        },
        credentials: "include",
        headers: { Authorization: "Bearer " + getLtik() },
      }).json();

      setMessage({ type: "success", text: "Canvas API key updated successfully!" });
      setHasApiKey(true);
      setLastUpdated(new Date().toISOString());
      setNewApiKey("");
      setIsValidKey(true);
      
      // Refresh the current API key status
      await fetchCurrentApiKey();
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setMessage({ type: "", text: "" });
      }, 3000);

    } catch (error) {
      console.error("Error saving API key:", error);
      setMessage({ 
        type: "error", 
        text: "Failed to save API key. Please try again." 
      });
    } finally {
      setSaving(false);
    }
  };

  const testApiKey = async () => {
    if (!currentApiKey) {
      setMessage({ type: "error", text: "No API key to test" });
      return;
    }

    try {
      setLoading(true);
      setMessage({ type: "", text: "" });

      // Test the API key by making a simple Canvas API call
      const response = await ky.get(`/api/instructor/${instructorCanvasId}/test-api-key`, {
        credentials: "include",
        headers: { Authorization: "Bearer " + getLtik() },
      }).json();

      if (response.valid) {
        setMessage({ type: "success", text: "API key is valid and working!" });
      } else {
        setMessage({ type: "error", text: "API key is invalid or not working" });
      }

    } catch (error) {
      console.error("Error testing API key:", error);
      setMessage({ type: "error", text: "Failed to test API key" });
    } finally {
      setLoading(false);
    }
  };



  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b pb-4">
        <h1 className="text-3xl font-bold text-gray-900">Instructor Settings</h1>
        <p className="text-gray-600 mt-2">
          Manage your Canvas API key and tool configuration
        </p>
      </div>

      {/* Canvas API Key Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Canvas API Key Management
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Update API Key */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Update API Key</Label>
            <div className="space-y-2">
              <div className="relative">
                <Input
                  type={showNewKey ? "text" : "password"}
                  value={newApiKey}
                  onChange={(e) => handleNewKeyChange(e.target.value)}
                  placeholder="Enter your new Canvas API key"
                  className="font-mono"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 top-1/2 transform -translate-y-1/2"
                  onClick={() => setShowNewKey(!showNewKey)}
                >
                  {showNewKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              

            </div>
            
            <div className="flex gap-2">
              <Button
                onClick={testNewApiKey}
                disabled={!newApiKey || !isValidKey || testing}
                variant="outline"
                className="w-full sm:w-auto"
              >
                {testing ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Test Key
                  </>
                )}
              </Button>
              <Button
                onClick={saveApiKey}
                disabled={!newApiKey || !isValidKey || saving || testing}
                className="w-full sm:w-auto"
              >
                {saving ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save API Key
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Messages */}
          {message.text && (
            <Alert className={message.type === "error" ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50"}>
              {message.type === "error" ? (
                <AlertCircle className="h-4 w-4 text-red-600" />
              ) : (
                <CheckCircle className="h-4 w-4 text-green-600" />
              )}
              <AlertDescription className={message.type === "error" ? "text-red-800" : "text-green-800"}>
                {message.text}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* API Key Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            How to Get Your Canvas API Key
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <h4 className="font-medium">Steps to generate a Canvas API key:</h4>
            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600">
              <li>Log into your Canvas account</li>
              <li>Go to <strong>Account</strong> → <strong>Settings</strong></li>
              <li>Scroll down to <strong>Approved Integrations</strong></li>
              <li>Click <strong>New Access Token</strong></li>
              <li>Enter a purpose (e.g., "EGP Broker Tool")</li>
              <li>Set an expiration date (recommended: 1 year)</li>
              <li>Click <strong>Generate Token</strong></li>
              <li>Copy the generated token (you won't see it again!)</li>
            </ol>
          </div>
          
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              <strong>Security Note:</strong> Your API key is encrypted and stored securely. 
              Never share your API key with others. If you suspect your key has been compromised, 
              generate a new one in Canvas and update it here.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Tool Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Tool Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium">Instructor Canvas ID</Label>
              <div className="mt-1 p-2 bg-gray-50 rounded border font-mono text-sm">
                {instructorCanvasId || "Not available"}
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium">Tool Status</Label>
              <div className="mt-1">
                <Badge variant="default" className="text-xs">
                  Active
                </Badge>
              </div>
            </div>
          </div>
          
          <div className="pt-4 border-t">
            <Button variant="outline" size="sm" onClick={fetchCurrentApiKey}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh Settings
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 