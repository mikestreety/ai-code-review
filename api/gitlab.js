import fetch from 'node-fetch';
import config from '../config.js';

async function fetchGitlabApi(gitlabUrl, endpoint, options = {}) {
  if (!config.gitlab.privateToken) {
    throw new Error(
      'GitLab private token is not configured. Please set GITLAB_PRIVATE_TOKEN environment variable.'
    );
  }
  const url = `${gitlabUrl}/api/v4/${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Private-Token': config.gitlab.privateToken,
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `GitLab API request failed with status ${response.status}: ${errorBody}`
    );
  }
  return response.json();
}

export async function getProjectCloneUrl(gitlabUrl, projectId) {
  const project = await fetchGitlabApi(gitlabUrl, `projects/${projectId}`);
  const url = new URL(project.http_url_to_repo);
  url.password = config.gitlab.privateToken;
  return url.toString();
}

export async function getMergeRequestDetails(gitlabUrl, projectId, mergeRequestIid) {
  return fetchGitlabApi(
    gitlabUrl,
    `projects/${projectId}/merge_requests/${mergeRequestIid}`
  );
}

export async function getMergeRequestDiff(gitlabUrl, projectId, mergeRequestIid) {
  const diffs = await fetchGitlabApi(
    gitlabUrl,
    `projects/${projectId}/merge_requests/${mergeRequestIid}/diffs`
  );
  return diffs.map((diff) => diff.diff).join('\n');
}

export async function getChangedFiles(gitlabUrl, projectId, mergeRequestIid) {
  const changes = await fetchGitlabApi(
    gitlabUrl,
    `projects/${projectId}/merge_requests/${mergeRequestIid}/changes`
  );
  return changes.changes.map((change) => change.new_path);
}

export async function getUnresolvedDiscussions(gitlabUrl, projectId, mergeRequestIid) {
  const discussions = await fetchGitlabApi(
    gitlabUrl,
    `projects/${projectId}/merge_requests/${mergeRequestIid}/discussions`
  );
  
  // Filter to only unresolved discussions
  const unresolvedDiscussions = discussions.filter(discussion => {
    // A discussion is unresolved if it's resolvable and not resolved
    return discussion.resolvable && !discussion.resolved;
  });
  
  return unresolvedDiscussions;
}

export async function postCommentToMergeRequest(
  gitlabUrl,
  projectId,
  mergeRequestIid,
  commentBody
) {
  return fetchGitlabApi(
    gitlabUrl,
    `projects/${projectId}/merge_requests/${mergeRequestIid}/notes`,
    {
      method: 'POST',
      body: JSON.stringify({ body: commentBody }),
    }
  );
}

export async function postLineCommentToMergeRequest(
  gitlabUrl,
  projectId,
  mergeRequestIid,
  commentBody,
  fileName,
  lineNumber,
  baseSha,
  startSha,
  headSha
) {
  return fetchGitlabApi(
    gitlabUrl,
    `projects/${projectId}/merge_requests/${mergeRequestIid}/discussions`,
    {
      method: 'POST',
      body: JSON.stringify({
        body: commentBody,
        position: {
          position_type: 'text',
          base_sha: baseSha,
          start_sha: startSha,
          head_sha: headSha,
          new_path: fileName,
          new_line: lineNumber,
        },
      }),
    }
  );
}
