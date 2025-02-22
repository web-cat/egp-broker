"use client";
import ky from "ky";
import React, { useEffect, useState } from "react";
import { Base } from "./base";
import { getLtik } from "@/lib/ltik";

export default function WelcomeBanner() {
  const [info, setInfo] = useState();
  const [role, setRole] = useState();

  useEffect(() => {
    const getInfo = async () => {
      try {
        const launchInfo = await ky
          .get("/lti/info", {
            credentials: "include",
            headers: { Authorization: "Bearer " + getLtik() },
          })
          .json();
        setInfo(launchInfo);

        console.log(launchInfo);
        // Regex to match URLs starting with membership and extract role
        const regex = /^http:\/\/purl\.imsglobal\.org\/vocab\/lis\/v2\/membership#(\w+)\.?$/;

        // Filter and extract roles from matching URLs
        const membershipRoles = launchInfo.roles.map(url => {
            const match = url.match(regex);
            return match ? match[1] : null; // Extract role or return null
        }).filter(Boolean); // Remove null values

        setRole(membershipRoles[0]);
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
        {info.context.title} - {role}
      </h2>

        <Base role={role} />
    </>
  );
}
