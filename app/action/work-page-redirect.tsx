"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function WorkPageRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/work");
  }, [router]);

  return (
    <div className="amc-panel">
      <div className="amc-panel__header">
        <h1>Action View moved</h1>
        <span>Redirecting to Work</span>
      </div>
    </div>
  );
}
