#!/usr/bin/env python3
"""Publish public star metadata on a data-only branch, without building the site."""
import argparse
import json
import os
import re
import subprocess
from datetime import datetime, timezone

BRANCH = 'github-stats'
FILE = 'stars.json'


class GitHub:
    def request(self, method, path, data=None, *, missing_ok=False):
        command = ['gh', 'api', '--hostname', 'github.com', '--method', method, path]
        if data is not None:
            command += ['--input', '-']
        result = subprocess.run(command, input=json.dumps(data) if data is not None else None,
                                capture_output=True, text=True, timeout=45)
        if result.returncode:
            if missing_ok and '(HTTP 404)' in result.stderr:
                return None
            raise RuntimeError('GitHub API request failed; inspect the workflow status and retry.')
        return json.loads(result.stdout)


def object_sha(value):
    if not isinstance(value, str) or not re.fullmatch(r'[a-f0-9]{40}', value):
        raise ValueError('Invalid GitHub object identifier.')
    return value


def snapshot(repository, api, now):
    if not re.fullmatch(r'[\w-]+/[\w.-]+', repository):
        raise ValueError('Expected a public GitHub owner/repository name.')
    data = api.request('GET', 'repos/' + repository)
    count = data.get('stargazers_count')
    full_name = data.get('full_name')
    if data.get('private') is not False or not isinstance(full_name, str) or full_name.lower() != repository.lower() or type(count) is not int or not 0 <= count <= 9007199254740991:
        raise ValueError('Only verified metadata from the expected public repository can be published.')
    return {'repository': 'https://github.com/' + repository, 'count': count,
            'checked_at': now.astimezone(timezone.utc).isoformat(timespec='seconds')}


def publish(repository, api, now, *, dry_run=False):
    data = snapshot(repository, api, now)
    if dry_run:
        return data
    base = 'repos/' + repository + '/git/'
    current = api.request('GET', base + 'ref/heads/' + BRANCH, missing_ok=True)
    parents = []
    if current is not None:
        parent = object_sha(current['object']['sha'])
        commit = api.request('GET', base + 'commits/' + parent)
        tree = api.request('GET', base + 'trees/' + object_sha(commit['tree']['sha']))
        entries = tree.get('tree', [])
        if tree.get('truncated') or len(entries) != 1 or entries[0].get('path') != FILE or entries[0].get('type') != 'blob' or entries[0].get('mode') != '100644':
            raise ValueError('github-stats must contain only the regular stars.json file; nothing was changed.')
        parents = [parent]
    tree = api.request('POST', base + 'trees', {'tree': [
        {'path': FILE, 'mode': '100644', 'type': 'blob', 'content': json.dumps(data, indent=2) + '\n'}]})
    commit = api.request('POST', base + 'commits', {
        'message': 'Refresh public GitHub star count', 'tree': object_sha(tree['sha']), 'parents': parents,
        'author': {'name': 'github-actions[bot]', 'email': '41898282+github-actions[bot]@users.noreply.github.com'}})
    sha = object_sha(commit['sha'])
    if current is None:
        api.request('POST', base + 'refs', {'ref': 'refs/heads/' + BRANCH, 'sha': sha})
    else:
        # A concurrent update must fail rather than overwrite another commit.
        api.request('PATCH', base + 'refs/heads/' + BRANCH, {'sha': sha, 'force': False})
    return data


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--repository', default=os.environ.get('GITHUB_REPOSITORY', ''))
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()
    result = publish(args.repository, GitHub(), datetime.now(timezone.utc), dry_run=args.dry_run)
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
