export const webTools = {
  web_search: async ({ query }) => {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const res = await fetch(url);
    if (!res.ok) return [];

    const data = await res.json();
    const results = [];

    if (data.AbstractText) {
      results.push({ type: 'abstract', text: data.AbstractText, source: data.AbstractSource });
    }
    if (data.Answer) {
      results.push({ type: 'answer', text: data.Answer });
    }
    if (data.RelatedTopics) {
      for (const topic of data.RelatedTopics.slice(0, 6)) {
        if (topic.Text) results.push({ type: 'related', text: topic.Text });
        if (topic.Topics) {
          for (const sub of topic.Topics.slice(0, 3)) {
            if (sub.Text) results.push({ type: 'related', text: sub.Text });
          }
        }
      }
    }
    return results;
  },

  web_fetch: async ({ url }) => {
    const parsed = new URL(url);
    const blockedHosts = ["127.0.0.1", "localhost", "0.0.0.0", "::1", "[::1]", "169.254.169.254", "metadata.google.internal", "100.100.100.200"];
    if (blockedHosts.includes(parsed.hostname) || /^10\.|^172\.(1[6-9]|2\d|3[01])\.|^192\.168\./.test(parsed.hostname) || parsed.hostname.endsWith(".internal") || parsed.hostname.endsWith(".local")) {
      throw new Error("Fetch from private/internal networks is not allowed");
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Fetch error: ${res.status}`);
    const text = await res.text();
    return text
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 6000);
  },
};
