"use client";

import { useEffect, useState } from "react";

interface CountdownTimerProps {
  endsAt: string | null;
  startsAt?: string | null;
  onEnd?: () => void;
  showSeconds?: boolean;
  className?: string;
}

export function CountdownTimer({ 
  endsAt, 
  startsAt, 
  onEnd,
  showSeconds = true,
  className = ""
}: CountdownTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState<string>("");
  const [isEnded, setIsEnded] = useState(false);
  const [isNotStarted, setIsNotStarted] = useState(false);

  useEffect(() => {
    if (!endsAt && !startsAt) {
      setTimeRemaining("No time limit");
      return;
    }

    const updateTimer = () => {
      const now = new Date().getTime();
      let targetTime: number | null = null;
      let isStart = false;

      // Check if election hasn't started yet
      if (startsAt) {
        const startTime = new Date(startsAt).getTime();
        if (startTime > now) {
          targetTime = startTime;
          isStart = true;
          setIsNotStarted(true);
          setIsEnded(false);
        } else {
          setIsNotStarted(false);
        }
      } else {
        setIsNotStarted(false);
      }

      // If started or no start time, check end time
      if (!isStart && endsAt) {
        const endTime = new Date(endsAt).getTime();
        if (endTime <= now) {
          setIsEnded(true);
          setTimeRemaining("Ended");
          if (onEnd) onEnd();
          return;
        } else {
          targetTime = endTime;
          setIsEnded(false);
        }
      }

      if (!targetTime) {
        setTimeRemaining("No time limit");
        return;
      }

      const difference = targetTime - now;

      if (difference <= 0) {
        setIsEnded(true);
        setTimeRemaining("Ended");
        if (onEnd && !isStart) onEnd();
        return;
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      // Format based on remaining time
      if (days > 0) {
        setTimeRemaining(`${days}d ${hours}h ${minutes}m${showSeconds ? ` ${seconds}s` : ""}`);
      } else if (hours > 0) {
        setTimeRemaining(`${hours}h ${minutes}m${showSeconds ? ` ${seconds}s` : ""}`);
      } else if (minutes > 0) {
        setTimeRemaining(`${minutes}m ${seconds}s`);
      } else {
        // Less than a minute - always show seconds
        setTimeRemaining(`${seconds}s`);
      }
    };

    updateTimer();
    
    // Determine update interval based on remaining time
    let intervalMs = 30000; // Default: 30 seconds
    if (endsAt) {
      const endTime = new Date(endsAt).getTime();
      const now = new Date().getTime();
      const hoursRemaining = (endTime - now) / (1000 * 60 * 60);
      if (hoursRemaining < 1) {
        intervalMs = 1000; // Less than 1 hour: update every second
      } else if (hoursRemaining < 24) {
        intervalMs = 5000; // Less than 24 hours: update every 5 seconds
      }
    }
    
    const interval = setInterval(updateTimer, intervalMs);
    return () => clearInterval(interval);
  }, [endsAt, startsAt, onEnd, showSeconds]);

  if (!endsAt && !startsAt) {
    return <span className={className}>No time limit</span>;
  }

  if (isEnded) {
    return (
      <span className={`${className} text-slate-400`}>
        Ended
      </span>
    );
  }

  if (isNotStarted) {
    return (
      <span className={`${className} text-amber-400`}>
        Starts in: {timeRemaining}
      </span>
    );
  }

  const hoursRemaining = endsAt ? (new Date(endsAt).getTime() - new Date().getTime()) / (1000 * 60 * 60) : Infinity;
  const isUrgent = hoursRemaining > 0 && hoursRemaining < 1;

  return (
    <span className={`${className} ${isUrgent ? "text-orange-400 font-semibold animate-pulse" : "text-slate-300"}`}>
      {timeRemaining}
    </span>
  );
}
