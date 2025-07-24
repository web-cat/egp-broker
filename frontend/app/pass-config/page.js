"use client";
import ky from "ky";
import React, { useEffect, useState } from "react";
import { Base } from '@/components/base';
import { getLtik } from "@/lib/ltik";
import { useRouter } from "next/navigation";

//Directs to page with pass configurations and overview
export default function PassConfig() {
  const [info, setInfo] = useState();
  const [error, setError] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const getInfo = async () => {
      try {
        setError(null);
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

  if (error) {
    return (
      <div className="text-center p-8 text-red-600">
        <p>{error}</p>
        <Button onClick={() => router.push('/')} className="mt-4">
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <>
        <Base launchInfo={info} />
    </>
  );
}