"""
Data migration:
1. Remap existing profile_id / member_id columns to user.id values
2. Insert rows into users_applicant (from ApplicantProfile + Member)
3. Insert rows into users_admin (from staff User rows)

Uses raw SQL for child-table inserts to avoid Django MTI re-saving the parent row.
"""

from django.db import migrations
from django.utils import timezone


STAFF_ROLES = {'Bookkeeper', 'Treasurer', 'Credit Committee', 'Account Member Officer'}


def migrate_users_forward(apps, schema_editor):
    db = schema_editor.connection

    with db.cursor() as cursor:
        # ------------------------------------------------------------------
        # Step 1: Disable FK checks, remap old IDs to user.id
        # ------------------------------------------------------------------
        cursor.execute("SET FOREIGN_KEY_CHECKS=0")

        # applicantbeneficiary.profile_id → ApplicantProfile.user_id
        cursor.execute(
            "UPDATE applicant_applicantbeneficiary b "
            "INNER JOIN applicant_applicantprofile p ON b.profile_id = p.id "
            "SET b.profile_id = p.user_id"
        )

        # savings.member_id → Member.user_id
        cursor.execute(
            "UPDATE applicant_savings s "
            "INNER JOIN applicant_member m ON s.member_id = m.id "
            "SET s.member_id = m.user_id"
        )

        # sharedcapital.member_id → Member.user_id
        cursor.execute(
            "UPDATE applicant_sharedcapital sc "
            "INNER JOIN applicant_member m ON sc.member_id = m.id "
            "SET sc.member_id = m.user_id"
        )

        # superadmin tables (likely empty, safe either way)
        cursor.execute(
            "UPDATE superadmin_violation v "
            "INNER JOIN applicant_member m ON v.member_id = m.id "
            "SET v.member_id = m.user_id"
        )
        cursor.execute(
            "UPDATE superadmin_disciplinaryaction da "
            "INNER JOIN applicant_member m ON da.member_id = m.id "
            "SET da.member_id = m.user_id"
        )
        cursor.execute(
            "UPDATE superadmin_terminationrecord tr "
            "INNER JOIN applicant_member m ON tr.member_id = m.id "
            "SET tr.member_id = m.user_id"
        )

        # ------------------------------------------------------------------
        # Step 2: Populate users_applicant from ApplicantProfile + Member
        # ------------------------------------------------------------------
        now = timezone.now().strftime('%Y-%m-%d %H:%M:%S')

        # Insert a minimal row for every applicant user first
        cursor.execute(
            "INSERT IGNORE INTO users_applicant "
            "  (user_ptr_id, employment_status, membership_type, membership_status, "
            "   profile_created_at, profile_updated_at) "
            "SELECT u.id, 'regular', 'associate', 'active', %s, %s "
            "FROM users_user u "
            "INNER JOIN users_role r ON u.role_id = r.id "
            "WHERE r.name = 'Applicant'",
            [now, now]
        )

        # Merge ApplicantProfile fields (UPDATE the rows we just created)
        cursor.execute(
            "UPDATE users_applicant a "
            "INNER JOIN applicant_applicantprofile p ON p.user_id = a.user_ptr_id "
            "SET "
            "  a.contact_number = p.contact_number, "
            "  a.secondary_contact = p.secondary_contact, "
            "  a.address_line1 = p.address_line1, "
            "  a.address_line2 = p.address_line2, "
            "  a.city = p.city, "
            "  a.province = p.province, "
            "  a.zip_code = p.zip_code, "
            "  a.permanent_address_line1 = p.permanent_address_line1, "
            "  a.permanent_address_barangay = p.permanent_address_barangay, "
            "  a.permanent_city = p.permanent_city, "
            "  a.permanent_province = p.permanent_province, "
            "  a.permanent_zip_code = p.permanent_zip_code, "
            "  a.civil_status = p.civil_status, "
            "  a.gender = p.gender, "
            "  a.middle_name = p.middle_name, "
            "  a.citizenship = COALESCE(p.citizenship, 'Filipino'), "
            "  a.spouse_name = p.spouse_name, "
            "  a.date_of_birth = p.date_of_birth, "
            "  a.tin = p.tin, "
            "  a.sss_number = p.sss_number, "
            "  a.highest_education = p.highest_education, "
            "  a.employment_category = p.employment_category, "
            "  a.employment_status = COALESCE(p.employment_status, 'regular'), "
            "  a.buksu_id_number = p.buksu_id_number, "
            "  a.office = p.office, "
            "  a.employer_name = p.employer_name, "
            "  a.employer_address = p.employer_address, "
            "  a.position = p.position, "
            "  a.monthly_income = p.monthly_income, "
            "  a.net_take_home_pay = p.net_take_home_pay, "
            "  a.years_employed = p.years_employed, "
            "  a.father_name = p.father_name, "
            "  a.father_occupation = p.father_occupation, "
            "  a.father_contact = p.father_contact, "
            "  a.mother_name = p.mother_name, "
            "  a.mother_occupation = p.mother_occupation, "
            "  a.mother_contact = p.mother_contact, "
            "  a.emergency_contact_name = p.emergency_contact_name, "
            "  a.emergency_contact_number = p.emergency_contact_number, "
            "  a.emergency_contact_relationship = p.emergency_contact_relationship, "
            "  a.id_photo = p.id_photo, "
            "  a.payslip = p.payslip, "
            "  a.coe_document = p.coe_document, "
            "  a.membership_form = p.membership_form"
        )

        # Merge Member fields
        cursor.execute(
            "UPDATE users_applicant a "
            "INNER JOIN applicant_member m ON m.user_id = a.user_ptr_id "
            "SET "
            "  a.membership_type = m.membership_type, "
            "  a.fixed_deposit = m.fixed_deposit, "
            "  a.verified_employment_status = m.verified_employment_status, "
            "  a.employment_status_verified_at = m.employment_status_verified_at, "
            "  a.employment_status_verified_by_id = m.employment_status_verified_by_id, "
            "  a.membership_status = m.membership_status, "
            "  a.subscribed_shares = m.subscribed_shares, "
            "  a.paid_shares = m.paid_shares, "
            "  a.member_since = m.member_since"
        )

        # ------------------------------------------------------------------
        # Step 3: Populate users_admin from staff User rows
        # ------------------------------------------------------------------
        cursor.execute(
            "INSERT IGNORE INTO users_admin (user_ptr_id, employee_id, department) "
            "SELECT u.id, NULL, NULL "
            "FROM users_user u "
            "INNER JOIN users_role r ON u.role_id = r.id "
            "WHERE r.name IN ('Bookkeeper', 'Treasurer', 'Credit Committee', 'Account Member Officer')"
        )

        cursor.execute("SET FOREIGN_KEY_CHECKS=1")


def migrate_users_backward(apps, schema_editor):
    with schema_editor.connection.cursor() as cursor:
        cursor.execute("SET FOREIGN_KEY_CHECKS=0")
        cursor.execute("DELETE FROM users_applicant")
        cursor.execute("DELETE FROM users_admin")
        cursor.execute("SET FOREIGN_KEY_CHECKS=1")


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0009_remove_user_employee_id_adminuser_applicant'),
    ]

    operations = [
        migrations.RunPython(migrate_users_forward, migrate_users_backward),
    ]
