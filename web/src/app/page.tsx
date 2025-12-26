// web/src/app/random/page.tsx
import { Suspense } from "react";
import RandomClient from "./random-client";

export const dynamic = "force-dynamic";

export default function RandomPage() {
  return (
    <Suspense fallback={<div style={{ padding: 16 }}>Loading...</div>}>
      <RandomClient />
    </Suspense>
  );
}
