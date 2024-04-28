"use client";

import dynamic from "next/dynamic";
import Navbar from "@/components/navbar";
import { Separator } from "@/components/ui/separator";
import { Card } from "@/components/ui/card";

const TextEditor = dynamic(() => import("@/components/editor"), {
  ssr: false,
});

export default function Home() {
  return (
    <div className="h-screen">
      <Navbar />
      <Separator />
      <div className="max-w-[1600px] h-[90vh] pb-8 pt-[21px] mx-auto md:px-8 px-4 w-full sm:items-center sm:space-y-0">
        <Card className="h-full overflow-hidden">
          <TextEditor language="python" />
        </Card>
      </div>
    </div>
  );
}
