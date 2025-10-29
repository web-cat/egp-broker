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
          // Check if coming from Canvas (ltik) or direct login (session)
          const urlParams = new URLSearchParams(window.location.search);
          const isSessionLogin = window.location.pathname === '/dashboard';
          let launchInfo;
          if (isSessionLogin) {
              // Direct login via password
              launchInfo = await ky.get("/auth/session-info", {
                  credentials: "include"
              }).json();
          } else {
               launchInfo = await ky.get("/lti/info", {
                  credentials: "include",
                  headers: {Authorization: "Bearer " + getLtik()},
              })
                  .json();
          }
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
}
