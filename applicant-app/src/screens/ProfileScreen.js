/**
 * Profile / Settings Screen — Dashboard color palette
 */

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import profileService from '../services/profileService';

// ── Design Tokens ──────────────────────────────────────────────────────────────
const PRIMARY   = '#0f1c52';
const GRAD      = '#17235a';
const ACCENT    = '#4D80E4';
const WHITE     = '#FFFFFF';
const PAGE_BG   = '#EEF4FF';
const CARD_BG   = '#F4F7FF';
const MUTED     = '#94A3B8';
const SECONDARY = '#64748B';

export default function ProfileScreen({ navigation }) {
  const { user, logout } = useAuth();
  const [loading, setLoading]               = useState(true);
  const [saving, setSaving]                 = useState(false);
  const [loggingOut, setLoggingOut]         = useState(false);
  const [profile, setProfile]               = useState(null);
  const [isEditing, setIsEditing]           = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword]         = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const [contactNumber, setContactNumber] = useState('');
  const [addressLine1, setAddressLine1]   = useState('');
  const [city, setCity]                   = useState('');
  const [province, setProvince]           = useState('');
  const [employerName, setEmployerName]   = useState('');
  const [position, setPosition]           = useState('');

  useEffect(() => { loadProfile(); }, []);

  const loadProfile = async () => {
    try {
      const data = await profileService.getProfile();
      setProfile(data.profile);
      setContactNumber(data.profile.contact_number || '');
      setAddressLine1(data.profile.address_line1 || '');
      setCity(data.profile.city || '');
      setProvince(data.profile.province || '');
      setEmployerName(data.profile.employer_name || '');
      setPosition(data.profile.position || '');
    } catch (error) {
      console.error('Load profile error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await profileService.updateProfile({
        contact_number: contactNumber,
        address_line1:  addressLine1,
        city, province,
        employer_name:  employerName,
        position,
      });
      Alert.alert('Success', 'Profile updated successfully');
      setIsEditing(false);
      loadProfile();
    } catch (error) {
      console.error('Save profile error:', error);
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout', style: 'destructive',
        onPress: async () => {
          setLoggingOut(true);
          await logout();
        },
      },
    ]);
  };

  const handleChangePassword = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowChangePassword(true);
  };

  const handleSubmitChangePassword = async () => {
    if (!currentPassword) { Alert.alert('Error', 'Current password is required'); return; }
    if (!newPassword || newPassword.length < 8) { Alert.alert('Error', 'New password must be at least 8 characters'); return; }
    if (newPassword !== confirmPassword) { Alert.alert('Error', 'Passwords do not match'); return; }

    setChangingPassword(true);
    try {
      await profileService.changePassword(currentPassword, newPassword, confirmPassword);
      setShowChangePassword(false);
      Alert.alert('Success', 'Password changed successfully');
    } catch (error) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={PRIMARY} />
        <Text style={styles.loadingText}>Loading profile…</Text>
      </SafeAreaView>
    );
  }

  const initials = user?.firstname?.[0]?.toUpperCase() || 'U';
  const fullName = [user?.firstname, user?.lastname].filter(Boolean).join(' ');

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={PRIMARY} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerOverlay} />
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Settings</Text>
          {!isEditing ? (
            <TouchableOpacity style={styles.editBtn} onPress={() => setIsEditing(true)}>
              <Text style={styles.editBtnText}>Edit Profile</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.cancelBtn} onPress={() => { setIsEditing(false); loadProfile(); }}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Avatar Card ── */}
        <View style={styles.avatarCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.userName}>{fullName}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>Applicant</Text>
          </View>
        </View>

        {/* ── Contact Information ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Information</Text>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Phone Number</Text>
            {isEditing ? (
              <TextInput style={styles.input} value={contactNumber} onChangeText={setContactNumber}
                placeholder="Enter phone number" keyboardType="phone-pad" placeholderTextColor={MUTED} />
            ) : (
              <Text style={styles.fieldValue}>{contactNumber || 'Not provided'}</Text>
            )}
          </View>
        </View>

        {/* ── Address ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Address</Text>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Street Address</Text>
            {isEditing ? (
              <TextInput style={styles.input} value={addressLine1} onChangeText={setAddressLine1}
                placeholder="Enter street address" placeholderTextColor={MUTED} />
            ) : (
              <Text style={styles.fieldValue}>{addressLine1 || 'Not provided'}</Text>
            )}
          </View>
          <View style={styles.fieldRow}>
            <View style={[styles.field, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.fieldLabel}>City</Text>
              {isEditing ? (
                <TextInput style={styles.input} value={city} onChangeText={setCity}
                  placeholder="City" placeholderTextColor={MUTED} />
              ) : (
                <Text style={styles.fieldValue}>{city || '—'}</Text>
              )}
            </View>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>Province</Text>
              {isEditing ? (
                <TextInput style={styles.input} value={province} onChangeText={setProvince}
                  placeholder="Province" placeholderTextColor={MUTED} />
              ) : (
                <Text style={styles.fieldValue}>{province || '—'}</Text>
              )}
            </View>
          </View>
        </View>

        {/* ── Employment ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Employment</Text>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Employer / Department</Text>
            {isEditing ? (
              <TextInput style={styles.input} value={employerName} onChangeText={setEmployerName}
                placeholder="Enter employer name" placeholderTextColor={MUTED} />
            ) : (
              <Text style={styles.fieldValue}>{employerName || 'Not provided'}</Text>
            )}
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Position</Text>
            {isEditing ? (
              <TextInput style={styles.input} value={position} onChangeText={setPosition}
                placeholder="Enter position" placeholderTextColor={MUTED} />
            ) : (
              <Text style={styles.fieldValue}>{position || 'Not provided'}</Text>
            )}
          </View>
        </View>

        {/* ── Save button ── */}
        {isEditing && (
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.btnDisabled]}
            onPress={handleSaveProfile}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color={WHITE} />
              : <Text style={styles.saveBtnText}>Save Changes</Text>
            }
          </TouchableOpacity>
        )}

        {/* ── Security ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Security</Text>
          <TouchableOpacity style={styles.menuItem} onPress={handleChangePassword}>
            <Text style={styles.menuItemText}>Change Password</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* ── Logout ── */}
        <TouchableOpacity
          style={[styles.logoutBtn, loggingOut && styles.btnDisabled]}
          onPress={handleLogout}
          disabled={loggingOut}
        >
          {loggingOut
            ? <ActivityIndicator color={WHITE} />
            : <Text style={styles.logoutBtnText}>Logout</Text>
          }
        </TouchableOpacity>

        <Text style={styles.versionText}>eLoan Applicant v1.0.0</Text>
      </ScrollView>

      {/* ── Change Password Modal ── */}
      <Modal
        visible={showChangePassword}
        transparent
        animationType="fade"
        onRequestClose={() => setShowChangePassword(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Change Password</Text>
            <TextInput style={styles.modalInput} placeholder="Current password"
              secureTextEntry value={currentPassword} onChangeText={setCurrentPassword}
              placeholderTextColor={MUTED} />
            <TextInput style={styles.modalInput} placeholder="New password (min 8 chars)"
              secureTextEntry value={newPassword} onChangeText={setNewPassword}
              placeholderTextColor={MUTED} />
            <TextInput style={styles.modalInput} placeholder="Confirm new password"
              secureTextEntry value={confirmPassword} onChangeText={setConfirmPassword}
              placeholderTextColor={MUTED} />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn}
                onPress={() => setShowChangePassword(false)} disabled={changingPassword}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmitBtn, changingPassword && styles.btnDisabled]}
                onPress={handleSubmitChangePassword} disabled={changingPassword}>
                {changingPassword
                  ? <ActivityIndicator color={WHITE} size="small" />
                  : <Text style={styles.modalSubmitText}>Update</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({

  screen:        { flex: 1, backgroundColor: PRIMARY },
  loadingScreen: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: PAGE_BG },
  loadingText:   { marginTop: 12, fontSize: 16, color: SECONDARY },

  // ── Header ──
  header: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 22,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    overflow: 'hidden',
  },
  headerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: GRAD,
    opacity: 0.55,
  },
  headerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle:   { fontSize: 24, fontFamily: 'Poppins_700Bold', color: WHITE },
  editBtn: {
    paddingHorizontal: 14, paddingVertical: 7,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  editBtnText:   { color: WHITE, fontSize: 13, fontFamily: 'Poppins_600SemiBold' },
  cancelBtn: {
    paddingHorizontal: 14, paddingVertical: 7,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  cancelBtnText: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontFamily: 'Poppins_600SemiBold' },

  // ── Scroll ──
  scrollContent: { backgroundColor: PAGE_BG, padding: 16, paddingBottom: 40 },

  // ── Avatar Card ──
  avatarCard: {
    backgroundColor: WHITE,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: PRIMARY,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  avatarText: { fontSize: 32, fontFamily: 'Poppins_700Bold', color: WHITE },
  userName:   { fontSize: 20, fontFamily: 'Poppins_700Bold', color: PRIMARY },
  userEmail:  { fontSize: 13, color: MUTED, marginTop: 4 },
  roleBadge: {
    marginTop: 10,
    paddingHorizontal: 14, paddingVertical: 4,
    backgroundColor: ACCENT + '20',
    borderRadius: 20, borderWidth: 1, borderColor: ACCENT + '40',
  },
  roleText: { fontSize: 12, color: ACCENT, fontFamily: 'Poppins_600SemiBold' },

  // ── Section ──
  section: {
    backgroundColor: WHITE,
    borderRadius: 14, padding: 16, marginBottom: 12,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  sectionTitle: {
    fontSize: 11, fontFamily: 'Poppins_800ExtraBold', color: PRIMARY,
    letterSpacing: 1.0, textTransform: 'uppercase',
    opacity: 0.55, marginBottom: 14,
  },
  field:      { marginBottom: 14 },
  fieldRow:   { flexDirection: 'row' },
  fieldLabel: { fontSize: 11, color: MUTED, marginBottom: 4, fontFamily: 'Poppins_600SemiBold', textTransform: 'uppercase', letterSpacing: 0.4 },
  fieldValue: { fontSize: 15, color: PRIMARY, fontFamily: 'Poppins_500Medium' },
  input: {
    borderWidth: 1.5, borderColor: 'rgba(15,28,82,0.15)',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 15, color: PRIMARY, backgroundColor: CARD_BG,
  },

  menuItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(15,28,82,0.08)',
  },
  menuItemText: { fontSize: 15, color: PRIMARY, fontFamily: 'Poppins_500Medium' },
  menuArrow:    { fontSize: 22, color: MUTED },

  // ── Buttons ──
  saveBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 14, padding: 16, alignItems: 'center',
    marginBottom: 12,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 10, elevation: 6,
  },
  saveBtnText:   { color: WHITE, fontSize: 16, fontFamily: 'Poppins_700Bold' },
  logoutBtn: {
    backgroundColor: '#EF4444',
    borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 4,
  },
  logoutBtnText: { color: WHITE, fontSize: 16, fontFamily: 'Poppins_700Bold' },
  btnDisabled:   { backgroundColor: MUTED },

  versionText: { textAlign: 'center', color: MUTED, fontSize: 12, marginTop: 24 },

  // ── Modal ──
  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(15,28,82,0.5)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  modalCard: {
    width: '100%', backgroundColor: WHITE,
    borderRadius: 20, padding: 20,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2, shadowRadius: 20, elevation: 12,
  },
  modalTitle:  { fontSize: 18, fontFamily: 'Poppins_700Bold', color: PRIMARY, marginBottom: 14 },
  modalInput: {
    borderWidth: 1.5, borderColor: 'rgba(15,28,82,0.15)',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 15, color: PRIMARY, backgroundColor: CARD_BG, marginBottom: 10,
  },
  modalActions:     { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 6 },
  modalCancelBtn:   { paddingVertical: 10, paddingHorizontal: 16, marginRight: 8 },
  modalCancelText:  { color: MUTED, fontSize: 14, fontFamily: 'Poppins_600SemiBold' },
  modalSubmitBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 10, paddingVertical: 10, paddingHorizontal: 20,
  },
  modalSubmitText: { color: WHITE, fontSize: 14, fontFamily: 'Poppins_700Bold' },
});
