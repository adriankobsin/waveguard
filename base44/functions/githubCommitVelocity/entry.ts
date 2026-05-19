import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { accessToken } = await base44.asServiceRole.connectors.getConnection("github");

    const body = await req.json();
    const { owner, repo } = body;

    if (!owner || !repo) {
      return Response.json({ error: "owner and repo are required" }, { status: 400 });
    }

    const headers = {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };

    // Fetch releases (up to 10)
    const releasesRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/releases?per_page=10`,
      { headers }
    );
    if (!releasesRes.ok) {
      const err = await releasesRes.json();
      return Response.json({ error: err.message || "GitHub API error" }, { status: releasesRes.status });
    }
    const releases = await releasesRes.json();

    if (releases.length === 0) {
      return Response.json({ releases: [], velocity: [] });
    }

    // For each consecutive pair of releases, count commits between them
    const velocity = [];

    for (let i = 0; i < Math.min(releases.length, 8); i++) {
      const release = releases[i];
      const prevRelease = releases[i + 1];

      let commitCount = 0;
      let additions = 0;
      let deletions = 0;

      if (prevRelease) {
        // Compare base..head to get commits between releases
        const compareRes = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/compare/${prevRelease.tag_name}...${release.tag_name}`,
          { headers }
        );
        if (compareRes.ok) {
          const compareData = await compareRes.json();
          commitCount = compareData.total_commits ?? 0;

          // Aggregate stats from up to 10 commits (API limit per compare)
          for (const c of (compareData.commits || []).slice(0, 10)) {
            const cRes = await fetch(
              `https://api.github.com/repos/${owner}/${repo}/commits/${c.sha}`,
              { headers }
            );
            if (cRes.ok) {
              const cData = await cRes.json();
              additions += cData.stats?.additions ?? 0;
              deletions += cData.stats?.deletions ?? 0;
            }
          }
        }
      } else {
        // First ever release — just count commits on default branch up to that tag
        const commitsRes = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/commits?sha=${release.tag_name}&per_page=100`,
          { headers }
        );
        if (commitsRes.ok) {
          const commits = await commitsRes.json();
          commitCount = commits.length;
        }
      }

      // Days between releases
      const releasedAt = new Date(release.published_at);
      const prevDate = prevRelease ? new Date(prevRelease.published_at) : null;
      const daysBetween = prevDate
        ? Math.max(1, Math.round((releasedAt - prevDate) / (1000 * 60 * 60 * 24)))
        : null;

      velocity.push({
        tag: release.tag_name,
        name: release.name || release.tag_name,
        publishedAt: release.published_at,
        commitCount,
        additions,
        deletions,
        daysBetween,
        commitsPerDay: daysBetween ? parseFloat((commitCount / daysBetween).toFixed(2)) : null,
        url: release.html_url,
        prerelease: release.prerelease,
        draft: release.draft,
      });
    }

    // Also fetch recent commit activity (weekly) for the sparkline
    const activityRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/stats/commit_activity`,
      { headers }
    );
    let weeklyActivity = [];
    if (activityRes.ok) {
      const raw = await activityRes.json();
      if (Array.isArray(raw)) {
        weeklyActivity = raw.slice(-12).map(w => ({
          week: new Date(w.week * 1000).toISOString().slice(0, 10),
          commits: w.total,
        }));
      }
    }

    // Repo info
    const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
    const repoInfo = repoRes.ok ? await repoRes.json() : {};

    return Response.json({
      repo: {
        fullName: repoInfo.full_name,
        description: repoInfo.description,
        defaultBranch: repoInfo.default_branch,
        stars: repoInfo.stargazers_count,
        openIssues: repoInfo.open_issues_count,
        language: repoInfo.language,
      },
      velocity,
      weeklyActivity,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});