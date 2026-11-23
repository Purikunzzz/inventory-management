import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { borrowService } from "../services/borrowService";
import { itemService } from "../services/itemService";
import { statsService } from "../services/statsService";
import { maintenanceService } from "../services/maintenanceService";
import { formatRelative, localDateISO } from "../lib/utils";

/**
 * Header notifications derived from real data (no notifications table):
 *  - everyone: own borrow approved / rejected, own borrows overdue
 *  - admins:   pending borrow requests, low stock, overdue maintenance,
 *              open issues reported by users (Report Issue on ItemDetail)
 * Only the "read" state is local (localStorage `lab_notifications_read`).
 */
const READ_KEY = "lab_notifications_read";
const LEGACY_KEY = "lab_header_notifications"; // old hardcoded demo list
const MAX_SHOWN = 20;
const REFRESH_MS = 60_000;
const RECENT_REVIEW_DAYS = 14;

// API timestamps carry a "Z" (UTC), so Date parses them correctly.
const toDate = (s) => (s ? new Date(s) : null);

function loadRead() {
  try {
    localStorage.removeItem(LEGACY_KEY);
    return new Set(JSON.parse(localStorage.getItem(READ_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function borrowNotifications(records, userId, itemName, now) {
  const recentCutoff = now - RECENT_REVIEW_DAYS * 86_400_000;
  const out = [];
  for (const r of records) {
    if (r.user_id !== userId) continue;
    const name = `${r.quantity} × ${itemName(r.item_id)}`;
    const reviewedAt = toDate(r.reviewed_at);
    const due = toDate(r.due_date);
    if (r.status === "borrowed" && due && due < now) {
      out.push({ id: `overdue-${r.id}`, title: "Return overdue", desc: `${name} was due back`, at: due, link: "/borrow" });
    }
    if (!reviewedAt || reviewedAt < recentCutoff) continue;
    if (r.status === "borrowed" || r.status === "returned") {
      out.push({ id: `approved-${r.id}`, title: "Borrow approved", desc: `Your request for ${name} was approved`, at: reviewedAt, link: "/borrow" });
    } else if (r.status === "rejected") {
      const why = r.review_note ? ` — ${r.review_note}` : "";
      out.push({ id: `rejected-${r.id}`, title: "Borrow rejected", desc: `Your request for ${name} was rejected${why}`, at: reviewedAt, link: "/borrow" });
    }
  }
  return out;
}

function adminNotifications(pending, lowStock, maintenance, itemName, today) {
  const out = pending.map((r) => ({
    id: `pending-${r.id}`,
    title: "Borrow request awaiting approval",
    desc: `${r.quantity} × ${itemName(r.item_id)}`,
    at: toDate(r.borrowed_at),
    link: "/admin",
  }));
  for (const i of lowStock) {
    out.push({
      // Include the quantity so a further drop re-notifies.
      id: `low-${i.item_id}-${i.available_quantity}`,
      title: "Low stock",
      desc: `${i.name}: ${i.available_quantity} left (threshold ${i.low_stock_threshold})`,
      at: null,
      link: `/inventory/${i.item_id}`,
    });
  }
  for (const m of maintenance) {
    if (m.status === "scheduled" && m.reported_by) {
      out.push({
        id: `issue-${m.id}`,
        title: "Issue reported",
        desc: `${m.reported_by}: ${m.item_name || `item #${m.item_id}`} — ${m.notes}`,
        at: toDate(m.created_at),
        link: "/maintenance",
      });
      continue;
    }
    if (m.status !== "scheduled" || m.scheduled_date >= today) continue;
    out.push({
      id: `maint-${m.id}`,
      title: "Maintenance overdue",
      desc: `${m.type} of ${m.item_name || `item #${m.item_id}`} was scheduled ${m.scheduled_date}`,
      at: new Date(`${m.scheduled_date}T00:00:00`),
      link: "/maintenance",
    });
  }
  return out;
}

export function useNotifications(currentUser) {
  const isAdmin = currentUser?.role === "admin";
  const enabled = !!currentUser;
  const poll = { refetchInterval: REFRESH_MS, staleTime: 30_000 };

  const { data: own = [] } = useQuery({
    queryKey: ["notifications", "own", currentUser?.id],
    queryFn: () => borrowService.listTransactions({ user_id: currentUser.id, limit: 100 }),
    enabled,
    ...poll,
  });
  const { data: pending = [] } = useQuery({
    queryKey: ["notifications", "pending"],
    queryFn: () => borrowService.listTransactions({ status_filter: "pending", limit: 100 }),
    enabled: enabled && isAdmin,
    ...poll,
  });
  const { data: lowStock = [] } = useQuery({
    queryKey: ["notifications", "low-stock"],
    queryFn: () => statsService.getLowStock(),
    enabled: enabled && isAdmin,
    ...poll,
  });
  const { data: maintenance = [] } = useQuery({
    queryKey: ["notifications", "maintenance"],
    queryFn: () => maintenanceService.listRecords({ status_filter: "scheduled" }),
    enabled: enabled && isAdmin,
    ...poll,
  });
  const { data: items = [] } = useQuery({
    queryKey: ["items", { limit: 1000 }],
    queryFn: () => itemService.listItems({ limit: 1000 }),
    enabled,
  });

  const [readIds, setReadIds] = useState(loadRead);
  useEffect(() => {
    try {
      // Keep the stored set bounded.
      localStorage.setItem(READ_KEY, JSON.stringify([...readIds].slice(-500)));
    } catch {}
  }, [readIds]);

  const notifications = useMemo(() => {
    const names = new Map(items.map((i) => [i.id, i.name]));
    const itemName = (id) => names.get(id) || `item #${id}`;
    const now = new Date();
    const today = localDateISO(now);
    const all = [
      ...borrowNotifications(own, currentUser?.id, itemName, now),
      ...(isAdmin ? adminNotifications(pending, lowStock, maintenance, itemName, today) : []),
    ];
    all.sort((a, b) => (b.at?.getTime() ?? 0) - (a.at?.getTime() ?? 0));
    return all.slice(0, MAX_SHOWN).map((n) => ({
      ...n,
      time: n.at ? formatRelative(n.at) : "Now",
      unread: !readIds.has(n.id),
    }));
  }, [own, pending, lowStock, maintenance, items, readIds, isAdmin, currentUser?.id]);

  const markRead = useCallback((id) => {
    setReadIds((prev) => new Set(prev).add(id));
  }, []);
  const markAllRead = useCallback(() => {
    setReadIds((prev) => {
      const next = new Set(prev);
      notifications.forEach((n) => next.add(n.id));
      return next;
    });
  }, [notifications]);

  return { notifications, markRead, markAllRead };
}
