"use client";
import ky from "ky";
import React, { useEffect, useState } from "react";
import { Base } from "./base";
import { getLtik } from "@/lib/ltik";

export default function WelcomeBanner() {
  const [info, setInfo] = useState();

  useEffect(() => {
    const getInfo = async () => {
      try {
        const launchInfo = await ky
          .get("/lti/info", {
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
      <h1 className="text-3xl font-bold">Hi {info.name}!</h1>
      <h2 className="text-2xl font-bold mb-6">
        {info.title} - {info.role}
      </h2>

        <Base launchInfo={info} />
    </>
  );
}
