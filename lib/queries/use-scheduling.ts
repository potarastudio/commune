"use client";

import { useQuery } from "@tanstack/react-query";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Container } from "./messages";
import { fetchScheduled, fetchUpcomingReminders, schedulingKeys, type ScheduledMessage, type UpcomingReminder } from "./scheduling";

export { schedulingKeys, type ScheduledMessage, type UpcomingReminder } from "./scheduling";

export function useScheduled(container: Container, initialData?: ScheduledMessage[]) {
  return useQuery({
    queryKey: schedulingKeys.scheduled(container),
    queryFn: () => fetchScheduled(getSupabaseBrowserClient(), container),
    initialData,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useUpcomingReminders(initialData?: UpcomingReminder[]) {
  return useQuery({
    queryKey: schedulingKeys.reminders,
    queryFn: () => fetchUpcomingReminders(getSupabaseBrowserClient()),
    initialData,
    staleTime: 30_000,
  });
}
