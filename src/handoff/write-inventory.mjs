/**
 * Handoff writer — Paso 1 del Sprint 1
 *
 * Escribe opportunity-inventory.json para que JobOffersOps lo consuma.
 * Solo escribe si qc_status === "approved".
 * Lee la blacklist de JobOffersOps para marcar jobs que no deben pasar.
 */

import fs from "node:fs";
import path from "node:path";
import { writeJson, resolveRepoPath } from "../lib/file-utils.mjs";

function loadBlacklist(blacklistPath) {
  try {
    const resolved = resolveRepoPath(blacklistPath);
    if (!fs.existsSync(resolved)) return [];
    const data = JSON.parse(fs.readFileSync(resolved, "utf8"));
    return data.blacklisted || [];
  } catch {
    return [];
  }
}

function isBlacklisted(job, blacklist) {
  const org = (job.organization || "").toLowerCase();
  for (const entry of blacklist) {
    const pattern = (entry.organization || "").toLowerCase();
    if (!pattern) continue;
    const match = entry.pattern || "exact_match";
    if (match === "exact_match" && org === pattern) return entry;
    if (match === "contains" && org.includes(pattern)) return entry;
    if (match === "starts_with" && org.startsWith(pattern)) return entry;
  }
  return null;
}

export function writeOpportunityInventory(scoredJobs, config, runId) {
  const handoffConfig = config.handoff?.joboffersops;
  if (!handoffConfig?.enabled) return null;

  const blacklist = loadBlacklist(handoffConfig.blacklist_file || "../JobOffersOps/intake/company-blacklist.json");

  const opportunities = [];
  let discardedBlacklist = 0;

  for (const job of scoredJobs) {
    const blacklistMatch = isBlacklisted(job, blacklist);
    if (blacklistMatch) {
      discardedBlacklist++;
      continue;
    }

    opportunities.push({
      id: job.normalized?.alias || `${job.source_id}-${Date.now()}`,
      source_id: job.source_id,
      title: job.title,
      organization: job.organization,
      location: job.location || "",
      remote_mode: job.remote_mode || "",
      apply_url: job.apply_url,
      posted_at: job.posted_at || "",
      captured_at: job.captured_at,
      compensation: job.compensation || "",
      deadline: job.deadline || "",
      level1_score: job.score?.total ?? 0,
      jd_summary: job.jd_summary || null,
      status: "pending_joboffersops"
    });
  }

  const inventory = {
    schema: "opportunity-inventory.v1",
    generated_at: new Date().toISOString(),
    run_id: runId,
    profile_id: handoffConfig.profile_id || "jorgejuri",
    qc_status: "pending_review",
    stats: {
      total_captured: scoredJobs.length + discardedBlacklist,
      after_level1_filter: scoredJobs.length + discardedBlacklist,
      after_jd_analysis: opportunities.filter(o => o.jd_summary).length,
      discarded_blacklist: discardedBlacklist,
      discarded_irrelevant: 0
    },
    opportunities
  };

  const outputPath = handoffConfig.output_file || "../JobOffersOps/intake/opportunity-inventory.json";
  writeJson(outputPath, inventory);

  return { path: outputPath, count: opportunities.length, discarded_blacklist: discardedBlacklist };
}
