"use client";

import { useEffect, useState } from "react";

import { pingServer } from "@/lib/api-client";

type Status = "idle" | "ok" | "error";

export default function ApiStatus() {
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => {
    let active = true;
    pingServer()
      .then((ok) => {
        if (active) {
          setStatus(ok ? "ok" : "error");
        }
      })
      .catch(() => {
        if (active) {
          setStatus("error");
        }
      });

    return () => {
      active = false;
    };
  }, []);

  if (status === "idle") {
    return <p className="text-sm text-muted-foreground">Checking server...</p>;
  }

  if (status === "ok") {
    return <p className="text-sm text-emerald-600">OK</p>;
  }

  return <p className="text-sm text-rose-600">Unavailable</p>;
}
