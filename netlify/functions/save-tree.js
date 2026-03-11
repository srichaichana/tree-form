exports.handler = async function(event, context) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const GITHUB_USER  = "srichaichana";
  const GITHUB_REPO  = "tree-form";
  const CSV_FILE     = "tree-inventory.csv";
  const CSV_HEADERS  = "Timestamp,Track_ID,X,Y,Thai_Name,Botanical,Genus,Speciesepi,GBH,Branches_GBH,Height,Crown_N,Crown_S,Crown_E,Crown_W,Crown_Total\n";

  if (!GITHUB_TOKEN) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "GitHub token not configured" })
    };
  }

  try {
    const data = JSON.parse(event.body);

    function csvEscape(v) {
      v = String(v || "");
      if (v.includes(",") || v.includes('"') || v.includes("\n")) {
        return '"' + v.replace(/"/g, '""') + '"';
      }
      return v;
    }

    const branches = data.branches
      .map((b, i) => "GBH" + (i + 1) + ":" + b.gbh)
      .join("|");

    const row = [
      data.timestamp, data.trackId, data.x, data.y,
      data.nameThai, data.botanical, data.genus, data.speciesepi,
      data.gbh, branches, data.height,
      data.crowncoverN, data.crowncovS, data.crowncovE, data.crowncovW,
      data.crownTotal
    ].map(csvEscape).join(",") + "\n";

    const apiBase = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${CSV_FILE}`;
    const headers = {
      "Authorization": `token ${GITHUB_TOKEN}`,
      "Content-Type": "application/json",
      "Accept": "application/vnd.github.v3+json"
    };

    // Get existing file
    let sha = null;
    let existingContent = CSV_HEADERS;

    const getResp = await fetch(apiBase, { headers });
    if (getResp.ok) {
      const fileData = await getResp.json();
      sha = fileData.sha;
      existingContent = Buffer.from(fileData.content.replace(/\n/g, ""), "base64").toString("utf8");
    }

    // Append new row
    const newContent = existingContent + row;
    const encoded = Buffer.from(newContent, "utf8").toString("base64");

    const body = {
      message: `Add tree: ${data.trackId} - ${data.timestamp}`,
      content: encoded
    };
    if (sha) body.sha = sha;

    const putResp = await fetch(apiBase, {
      method: "PUT",
      headers,
      body: JSON.stringify(body)
    });

    if (!putResp.ok) {
      const err = await putResp.json();
      throw new Error(err.message || "GitHub API error");
    }

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ status: "success" })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: err.message })
    };
  }
};
