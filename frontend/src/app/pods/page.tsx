"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PodsPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to nodes page since pods functionality is now there
    router.replace("/nodes");
  }, [router]);

  return null;
}
