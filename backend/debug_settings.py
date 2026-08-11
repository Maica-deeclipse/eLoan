#!/usr/bin/env python
import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'eloan_core.settings')

from eloan_core import settings
import pprint

print("=" * 80)
print("DATABASES Configuration:")
print("=" * 80)
pprint.pprint(settings.DATABASES)

print("\n" + "=" * 80)
print("Database Engine Details:")
print("=" * 80)
print(f"Engine Class: {settings.DATABASES['default']['ENGINE']}")
print(f"Name/File: {settings.DATABASES['default'].get('NAME', 'N/A')}")

print("\n" + "=" * 80)
print("BASE_DIR:")
print("=" * 80)
print(f"BASE_DIR: {settings.BASE_DIR}")
print(f"Type: {type(settings.BASE_DIR)}")
print(f"DB File should be at: {settings.BASE_DIR / 'db.sqlite3' if hasattr(settings.BASE_DIR, '__truediv__') else settings.BASE_DIR + '/db.sqlite3'}")
