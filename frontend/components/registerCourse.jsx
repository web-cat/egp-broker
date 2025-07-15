"use client"

import * as React from "react"
import MultiSelectPassCards from "./selectPasses"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  BookOpen, 
  Key, 
  Eye, 
  EyeOff, 
  Shield, 
  Info,
  GraduationCap,
  Calendar,
  User,
  CheckCircle,
  AlertCircle,
  Loader2,
  Repeat
} from "lucide-react"
import { getLtik } from "@/lib/ltik"
import ky from "ky"

export default function RegisterCourseForm({ courseCanvasId, title, description, instructorCanvasId, passes }) {
  const [canvasApiKey, setCanvasApiKey] = React.useState("")
  const [showApiKey, setShowApiKey] = React.useState(false)
  const [showInstructions, setShowInstructions] = React.useState(false)
  const [testing, setTesting] = React.useState(false)
  const [isValidKey, setIsValidKey] = React.useState(false)
  const [isApiKeyTested, setIsApiKeyTested] = React.useState(false)
  const [message, setMessage] = React.useState({ type: "", text: "" })
  const [selectedPasses, setSelectedPasses] = React.useState([])
  const [passesData, setPassesData] = React.useState([])
  const [submitting, setSubmitting] = React.useState(false)

  const validateApiKey = (key) => {
    if (!key) return false;
    
    // Basic Canvas API key validation (minimum length)
    const isValid = key.length >= 20;
    setIsValidKey(isValid);
    if (!isValid) {
      setIsApiKeyTested(false); // Reset test status if key becomes invalid
    }
    return isValid;
  };

  const handleApiKeyChange = (value) => {
    setCanvasApiKey(value);
    validateApiKey(value);
    setMessage({ type: "", text: "" }); // Clear previous messages
    setIsApiKeyTested(false); // Reset test status when key changes
  };

  const testApiKey = async () => {
    if (!canvasApiKey || !validateApiKey(canvasApiKey)) {
      setMessage({ type: "error", text: "Please enter a valid Canvas API key first" });
      return;
    }

    try {
      setTesting(true);
      setMessage({ type: "", text: "" });

      // Test the new API key by making a simple Canvas API call
      const response = await ky.post(`/api/instructor/${instructorCanvasId}/test-new-api-key`, {
        json: { canvasApiKey: canvasApiKey },
        credentials: "include",
        headers: { Authorization: "Bearer " + getLtik() },
      }).json();

      if (response.valid) {
        setMessage({ type: "success", text: "API key test successful! You can proceed with course setup." });
        setIsApiKeyTested(true);
        return true;
      } else {
        setMessage({ type: "error", text: response.message || "API key test failed" });
        setIsApiKeyTested(false);
        return false;
      }

    } catch (error) {
      console.error("Error testing API key:", error);
      setMessage({ type: "error", text: "Failed to test API key. Please check your key and try again." });
      setIsApiKeyTested(false);
      return false;
    } finally {
      setTesting(false);
    }
  };

  const handlePassSelectionChange = (selected, passes) => {
    setSelectedPasses(selected);
    setPassesData(passes);
  };

  const handleSubmission = async () => {
    // Check if API key is valid and tested
    if (!isApiKeyTested) {
      setMessage({ type: "error", text: "Please test your Canvas API key before submitting. The API key must be valid and successfully tested." });
      return;
    }

    // Check if at least one pass is selected
    if (selectedPasses.length === 0) {
      setMessage({ type: "error", text: "Please select at least one pass type before submitting." });
      return;
    }

    setSubmitting(true);
    setMessage({ type: "", text: "" });

    try {
      const course = {
        courseCanvasId,
        title,
        description,
        instructorCanvasId,
        canvasApiKey,
        allowedPassTypes: []
      };

      passesData.forEach((pass) => {
        if (selectedPasses.includes(pass._id)) {
          course.allowedPassTypes.push({
            passId: pass._id,
            initialCount: pass.quantity,
          })
        }
      });

      console.log("course:", course);

      // First save the Canvas API key if provided
      if (course.canvasApiKey) {
        try {
          await ky.post("/api/course/save-api-key", {
            json: {
              instructorCanvasId: course.instructorCanvasId,
              canvasApiKey: course.canvasApiKey
            },
            credentials: "include",
            headers: { Authorization: "Bearer " + getLtik() },
          }).json();
          console.log("Canvas API key saved successfully");
        } catch (error) {
          console.error("Error saving Canvas API key:", error);
          // Continue with course submission even if API key save fails
        }
      }

      await ky.post("/api/course/add", {
        json: course,
        credentials: "include",
        headers: { Authorization: "Bearer " + getLtik() },
      }).json();

      window.location.href = `/?ltik=${getLtik()}`;
    } catch (error) {
      console.error("Error submitting course:", error);
      setMessage({ type: "error", text: "Failed to submit course. Please try again." });
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = isApiKeyTested && selectedPasses.length > 0 && !submitting;

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-gray-900">Welcome to the EGP Broker Tool</h1>
        </div>
        <p className="text-lg text-gray-600 max-w-2xl">
          Configure your course with free passes to help students manage their assignments and deadlines.
        </p>
      </div>

      {/* Canvas API Key Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Canvas API Key
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="canvas-api-key" className="text-sm font-medium">
                API Key
              </Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowInstructions(!showInstructions)}
                className="text-blue-600 hover:text-blue-700"
              >
                <Info className="h-4 w-4 mr-1" />
                {showInstructions ? "Hide Instructions" : "How to Get API Key"}
              </Button>
            </div>
            
            <div className="relative">
              <Input
                id="canvas-api-key"
                type={showApiKey ? "text" : "password"}
                value={canvasApiKey}
                onChange={(e) => handleApiKeyChange(e.target.value)}
                placeholder="Enter your Canvas API key"
                className="font-mono pr-12"
              />
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-2 top-1/2 transform -translate-y-1/2"
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            
            <div className="flex items-center gap-3">
              <Button
                onClick={testApiKey}
                disabled={!isValidKey || testing}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                {testing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    Test API Key
                  </>
                )}
              </Button>
              {isValidKey && (
                <Badge variant="secondary" className="text-xs">
                  Valid Format
                </Badge>
              )}
              {isApiKeyTested && (
                <Badge variant="default" className="text-xs bg-green-100 text-green-800">
                  Tested Successfully
                </Badge>
              )}
            </div>
            
            <p className="text-sm text-gray-600">
              Your Canvas API key is required to sync assignments and manage due dates. 
              It's encrypted and stored securely.
            </p>
          </div>

          {/* Message Display */}
          {message.text && (
            <Alert variant={message.type === "success" ? "default" : "destructive"}>
              {message.type === "success" ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <AlertDescription>{message.text}</AlertDescription>
            </Alert>
          )}

          {/* API Key Instructions */}
          {showInstructions && (
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-3">
                  <h4 className="font-medium">Steps to generate a Canvas API key:</h4>
                  <ol className="list-decimal list-inside space-y-2 text-sm">
                    <li>Log into your Canvas account</li>
                    <li>Go to <strong>Account</strong> → <strong>Settings</strong></li>
                    <li>Scroll down to <strong>Approved Integrations</strong></li>
                    <li>Click <strong>New Access Token</strong></li>
                    <li>Enter a purpose (e.g., "EGP Broker Tool")</li>
                    <li>Set an expiration date (recommended: 1 year)</li>
                    <li>Click <strong>Generate Token</strong></li>
                    <li>Copy the generated token (you won't see it again!)</li>
                  </ol>
                  <div className="mt-3 p-3 bg-blue-50 rounded-md">
                    <p className="text-sm font-medium text-blue-800">
                      <strong>Security Note:</strong> Your API key is encrypted and stored securely. 
                      Never share your API key with others. If you suspect your key has been compromised, 
                      generate a new one in Canvas and update it here.
                    </p>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Pass Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Configure Free Passes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-6">
            Choose which types of free passes you want to offer to your students and how many of each.
          </p>
          <MultiSelectPassCards 
            passes_base={passes} 
            onSelectionChange={handlePassSelectionChange}
          />
        </CardContent>
      </Card>

      {/* Submit Section */}
      <div className="space-y-4">
        {/* API Key Validation Warning */}
        {!isApiKeyTested && canvasApiKey && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Please test your Canvas API key before submitting. The API key must be valid and successfully tested.
            </AlertDescription>
          </Alert>
        )}

        {/* Submit Button */}
        <div className="flex justify-center">
          <Button 
            onClick={handleSubmission} 
            disabled={!canSubmit}
            className={!canSubmit ? "opacity-50 cursor-not-allowed" : ""}
            size="lg"
          >
            {submitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Setting Up Course...
              </>
            ) : (
              <>
                <Repeat className="w-4 h-4 mr-2" />
                Complete Course Setup
              </>
            )}
          </Button>
        </div>

        {/* Submission Requirements */}
        {!canSubmit && (
          <div className="text-center text-sm text-gray-600">
            <p>To complete setup, you need:</p>
            <ul className="list-disc list-inside mt-1 space-y-1">
              {!isApiKeyTested && <li>A valid and tested Canvas API key</li>}
              {selectedPasses.length === 0 && <li>At least one pass type selected</li>}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}