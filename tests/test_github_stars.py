import importlib.util
import json
import unittest
from datetime import datetime, timezone
from pathlib import Path

spec = importlib.util.spec_from_file_location('star_publisher', Path(__file__).resolve().parents[1] / 'scripts/publish_github_stars.py')
publisher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(publisher)


class FakeAPI:
    def __init__(self, *, existing=False, private=False, count=0, polluted=False, full_name='example/product'):
        self.existing, self.private, self.count, self.polluted, self.full_name = existing, private, count, polluted, full_name
        self.calls = []

    def request(self, method, path, data=None, **kwargs):
        self.calls.append((method, path, data))
        if path == 'repos/example/product':
            return {'private': self.private, 'full_name': self.full_name, 'stargazers_count': self.count}
        if '/ref/heads/' in path:
            return {'object': {'sha': 'a' * 40}} if self.existing else None
        if method == 'GET' and '/commits/' in path:
            return {'tree': {'sha': 'd' * 40}}
        if method == 'GET' and '/trees/' in path:
            return {'tree': [{'path': 'README.md' if self.polluted else 'stars.json', 'mode': '100644', 'type': 'blob'}]}
        return {'sha': ('b' if path.endswith('/trees') else 'c') * 40}


class PublicStarsPublisherTests(unittest.TestCase):
    now = datetime(2026, 11, 1, 6, 17, tzinfo=timezone.utc)

    def test_initial_publish_is_an_orphan_with_only_public_metadata(self):
        api = FakeAPI()
        result = publisher.publish('example/product', api, self.now)
        self.assertEqual(set(result), {'repository', 'count', 'checked_at'})
        self.assertEqual(result['count'], 0)
        tree = next(data for method, path, data in api.calls if method == 'POST' and path.endswith('/trees'))
        self.assertEqual([entry['path'] for entry in tree['tree']], ['stars.json'])
        self.assertEqual(json.loads(tree['tree'][0]['content']), result)
        commit = next(data for method, path, data in api.calls if method == 'POST' and path.endswith('/commits'))
        self.assertEqual(commit['parents'], [])
        self.assertEqual(api.calls[-1][2]['ref'], 'refs/heads/github-stats')
        self.assertFalse(any('/heads/main' in path for _, path, _ in api.calls))

    def test_updates_keep_history_and_never_force_push(self):
        api = FakeAPI(existing=True, count=12)
        publisher.publish('example/product', api, self.now)
        commit = next(data for method, path, data in api.calls if method == 'POST' and path.endswith('/commits'))
        self.assertEqual(commit['parents'], ['a' * 40])
        self.assertEqual(api.calls[-1], ('PATCH', 'repos/example/product/git/refs/heads/github-stats', {'sha': 'c' * 40, 'force': False}))

    def test_private_wrong_or_malformed_repository_metadata_is_never_written(self):
        for options in [{'private': True}, {'count': -1}, {'count': True}, {'count': '12'}, {'count': 10**20}, {'full_name': None}, {'full_name': 'someone/else'}]:
            with self.subTest(options=options):
                api = FakeAPI(**options)
                with self.assertRaises(ValueError):
                    publisher.publish('example/product', api, self.now)
                self.assertEqual([method for method, _, _ in api.calls], ['GET'])

    def test_unexpected_files_are_not_deleted_or_overwritten(self):
        api = FakeAPI(existing=True, polluted=True)
        with self.assertRaisesRegex(ValueError, 'only the regular'):
            publisher.publish('example/product', api, self.now)
        self.assertFalse(any(method != 'GET' for method, _, _ in api.calls))

    def test_dry_run_and_invalid_names_cannot_publish(self):
        api = FakeAPI()
        publisher.publish('example/product', api, self.now, dry_run=True)
        self.assertEqual(len(api.calls), 1)
        for name in ['example/product/extra', 'https://github.com/example/product', 'example/product?token=value', 'example/product;command']:
            with self.subTest(name=name), self.assertRaises(ValueError):
                publisher.publish(name, api, self.now)
        self.assertEqual(len(api.calls), 1)
