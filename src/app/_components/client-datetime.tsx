"use client";

import { format } from "date-fns";

export function ClientDateTime({ date }: { date: Date }) {
  return (
    <span title={format(date, "yyyy-MM-dd HH:mm:ss aa")}>
      {format(date, "MMM d, h:mm:ss a")}
    </span>
  );
}
