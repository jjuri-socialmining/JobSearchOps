import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are a job search optimization assistant. Analyze dismissed job records to identify patterns and return concrete, actionable recommendations for improving the job search pipeline's scoring and filtering.

Focus on:
1. Title patterns that should be excluded (recurring words/phrases in dismissed job titles)
2. Organization types that don't fit the user's profile
3. Score calibration issues (high-scoring jobs being dismissed anyway, suggests scoring weights need adjustment)
4. Common dismiss reasons that reveal keyword or filter gaps

Return a JSON object with this exact shape:
{
  "patterns": [
    { "type": "title_exclusion" | "org_exclusion" | "score_calibration" | "keyword_gap", "description": "...", "examples": ["..."] }
  ],
  "recommendations": ["..."],
  "high_priority_signals": ["..."]
}

Be specific and actionable. Reference actual titles and organizations from the data.`;

export async function analyzeDismissals(dismissedJobs) {
  if (!dismissedJobs || dismissedJobs.length === 0) return null;

  const jobSummary = dismissedJobs.map(j => ({
    title: j.title,
    company: j.company,
    score: j.score,
    reason: j.dismiss_reason || '(no reason given)',
    dismiss_date: j.dismiss_date,
  }));

  const stream = client.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: `Analyze these ${dismissedJobs.length} dismissed jobs and return your analysis as JSON:\n\n${JSON.stringify(jobSummary, null, 2)}`,
      },
    ],
  });

  const response = await stream.finalMessage();
  const text = response.content.find(b => b.type === 'text')?.text ?? '';

  try {
    const match = text.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : { raw: text };
  } catch {
    return { raw: text };
  }
}
