/*"use client";
import ky from "ky";
import React, { useEffect, useState } from "react";
import { Base } from "./base";
import { getLtik } from "@/lib/ltik";

export default function WelcomeBanner() {
  const [info, setInfo] = useState();

  useEffect(() => {
    const getInfo = async () => {
      try {
        const launchInfo = await ky.get("/lti/info", {
            credentials: "include",
            headers: { Authorization: "Bearer " + getLtik() },
          })
          .json();
          console.log("Launch info:", launchInfo);
        setInfo(launchInfo);

      } catch (err) {
        console.log(err);
      }
    };
    getInfo();
  }, []);

  if (!info) {
    return <div>Loading...</div>;
  }

  return (
    <>
        <Base launchInfo={info} />
    </>
  );
}*/

"use client";
import React, { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getLtik, setLtik } from "@/lib/ltik";

export default function WelcomeBanner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const ltikFromUrl = searchParams.get('ltik');
    if (ltikFromUrl) {
      console.log("WelcomeBanner: LTIK found in URL, setting:", ltikFromUrl);
      setLtik(ltikFromUrl);
    } else {
      console.log("WelcomeBanner: No LTIK found in URL.");
    }
  }, [searchParams]);

  const handleGoToPassConfig = () => {
    router.push("/pass-config");
  };

  const handleGoToToolConfig = () => {
    router.push("/tool-config");
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <h1 className="text-4xl font-bold mb-6">Welcome to EGP-Broker LTI Tool!</h1>
      <p className="text-lg mb-8 text-gray-700">Please select an option:</p>
      <div className="flex space-x-4">
        <Button onClick={handleGoToPassConfig}>
          Pass Config
        </Button>
        <Button onClick={handleGoToToolConfig}>
          LTI Tool Config
        </Button>
      </div>
    </div>
  );
}