import os
import django
import json
import urllib.request
from urllib.error import HTTPError

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'eloan_core.settings')
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in os.sys.path:
    os.sys.path.insert(0, BASE_DIR)

django.setup()

from users.models import User, Role

email = 'mobile_test@applicant.com'
pwd = 'MobilePass123!'
applicant_role, _ = Role.objects.get_or_create(name='Applicant')
user = User.objects.filter(email=email).first()
if not user:
    user = User.objects.create_user(email=email, password=pwd, firstname='Mobile', lastname='Tester')
    user.role = applicant_role
    user.is_staff = False
    user.account_status = 'approved'
    user.status = 'active'
    user.save()
    print('Created user:', user.email)
else:
    print('Existing user:', user.email, 'role=', user.role.name if user.role else None)

url = 'http://192.168.100.17:8000/api/auth/applicant/login/'
req = urllib.request.Request(url, data=json.dumps({'email': email, 'password': pwd}).encode('utf-8'), method='POST')
req.add_header('Content-Type', 'application/json')
try:
    with urllib.request.urlopen(req, timeout=10) as resp:
        print('status', resp.status)
        print(resp.read().decode('utf-8'))
except HTTPError as e:
    print('status', e.code)
    print(e.read().decode('utf-8'))
except Exception as e:
    print('error', e)
