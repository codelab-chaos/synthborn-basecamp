"use client";
import { TimeCountdown } from "@/components/time-countdown";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import HMDark from "@/../public/branding/hytalemodding/HM_DARK.svg";
import HMLight from "@/../public/branding/hytalemodding/HM_LIGHT.svg";
import { ModeToggle } from "./mode-toggle";

import BG from "./bg.png";

export default function Countdown() {
  const targetDate = new Date("2026-06-08T10:00:00");
  const router = useRouter();

  useEffect(() => {
    const timeout = setTimeout(() => {
      router.push("https://hmod.link/secret");
    }, targetDate.getTime() - Date.now());

    return () => clearTimeout(timeout);
  }, []);

  return (
    <>
      <div className="absolute bottom-4 left-4">
        <ModeToggle />
      </div>

      <Image
        src={BG}
        alt="Background"
        fill
        className="mask-b-from-50% opacity-45 blur-sm"
      />

      <div className="absolute top-0 left-0 flex w-full flex-col items-center py-16">
        <Image
          alt="Hytale Modding"
          src={HMDark}
          className="h-16 w-auto not-dark:hidden"
          priority
        />
        <Image
          alt="Hytale Modding"
          src={HMLight}
          className="h-16 w-auto dark:hidden"
          priority
        />
      </div>

      <div className="absolute top-0 left-0 flex h-screen w-full flex-col items-center justify-center gap-16">
        <TimeCountdown
          targetDate={targetDate}
          options={{
            fontSize: 48,
            duration: 0.75,
            easing: "anticipate",
          }}
        />
      </div>
    </>
  );
}

// You thought you'd look at the source and figure it out right? Nope! Gotta wait to find out the secret
