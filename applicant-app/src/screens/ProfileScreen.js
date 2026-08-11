/**
 * Profile / Settings Screen — Dashboard color palette
 */

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
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
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../context/AuthContext';
import profileService from '../services/profileService';
import logger from '../utils/logger';

const EMP_STATUS_LABELS = {
  regular: 'Regular',
  casual: 'Casual',
  job_order: 'Job Order',
  part_time: 'Part-time',
};

const EMP_STATUS_OPTIONS = [
  { value: 'regular', label: 'Regular' },
  { value: 'casual', label: 'Casual' },
  { value: 'job_order', label: 'Job Order' },
  { value: 'part_time', label: 'Part-time' },
];

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
  const { user, logout, updateUser } = useAuth();
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

  // Employment status change request
  const [empStatusRequest, setEmpStatusRequest]         = useState(null);
  const [showEmpStatusModal, setShowEmpStatusModal]     = useState(false);
  const [newEmpStatus, setNewEmpStatus]                 = useState('');
  const [coeDoc, setCoeDoc]                             = useState(null);
  const [submittingEmpStatus, setSubmittingEmpStatus]   = useState(false);
  const [uploadingPhoto, setUploadingPhoto]             = useState(false);

  useEffect(() => { loadProfile(); }, []);

  const loadProfile = async () => {
    try {
      const [profileData, empReqData] = await Promise.all([
        profileService.getProfile(),
        profileService.getLatestEmploymentStatusRequest(),
      ]);
      setProfile(profileData.profile);
      setContactNumber(profileData.profile.contact_number || '');
      setAddressLine1(profileData.profile.address_line1 || '');
      setCity(profileData.profile.city || '');
      setProvince(profileData.profile.province || '');
      setEmployerName(profileData.profile.employer_name || '');
      setPosition(profileData.profile.position || '');
      setEmpStatusRequest(empReqData);
    } catch (error) {
      logger.error('Load profile error:', error);
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
      logger.error('Save profile error:', error);
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handlePickPhoto = async () => {
    const { status: perm } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm !== 'granted') {
      Alert.alert('Permission required', 'Please allow access to your photo library.');
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (picked.canceled || !picked.assets?.length) return;
    const asset = picked.assets[0];

    // Size guard (~5 MB)
    if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
      Alert.alert('File too large', 'Please choose an image under 5 MB.');
      return;
    }

    Alert.alert(
      'Update Profile Photo',
      'Are you sure you want to update your profile picture?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Update',
          onPress: async () => {
            setUploadingPhoto(true);
            try {
              const result = await profileService.uploadProfilePicture(asset.uri);
              updateUser({ profile_picture: result.profile_picture });
              Alert.alert('Success', 'Profile photo updated!');
            } catch (err) {
              Alert.alert('Error', err.response?.data?.error || 'Failed to upload photo');
            } finally {
              setUploadingPhoto(false);
            }
          },
        },
      ]
    );
  };

  const handleRemovePhoto = () => {
    if (!user?.profile_picture) return;
    Alert.alert(
      'Remove Profile Photo',
      'Are you sure you want to remove your profile picture?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive',
          onPress: async () => {
            setUploadingPhoto(true);
            try {
              await profileService.removeProfilePicture();
              updateUser({ profile_picture: null });
              Alert.alert('Done', 'Profile photo removed.');
            } catch (err) {
              Alert.alert('Error', err.response?.data?.error || 'Failed to remove photo');
            } finally {
              setUploadingPhoto(false);
            }
          },
        },
      ]
    );
  };

  const handlePickCOE = async () => {
    const { status: perm } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm !== 'granted') {
      Alert.alert('Permission required', 'Please allow access to your photo library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets?.length > 0) {
      setCoeDoc(result.assets[0]);
    }
  };

  const handleSubmitEmpStatusChange = async () => {
    if (!newEmpStatus) {
      Alert.alert('Error', 'Please select a new employment status.');
      return;
    }
    if (!coeDoc) {
      Alert.alert('Error', 'Please upload your Certificate of Employment (COE).');
      return;
    }
    setSubmittingEmpStatus(true);
    try {
      await profileService.submitEmploymentStatusChangeRequest(newEmpStatus, coeDoc);
      setShowEmpStatusModal(false);
      setNewEmpStatus('');
      setCoeDoc(null);
      Alert.alert('Request Submitted', 'Your employment status change request is now pending AMO review.');
      loadProfile();
    } catch (error) {
      const msg = error.response?.data?.error || 'Failed to submit request. Please try again.';
      Alert.alert('Error', msg);
    } finally {
      setSubmittingEmpStatus(false);
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
          <TouchableOpacity onPress={handlePickPhoto} disabled={uploadingPhoto} style={styles.avatarWrapper}>
            {user?.profile_picture ? (
              <Image source={{ uri: user.profile_picture }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
            )}
            {uploadingPhoto && (
              <View style={styles.avatarOverlay}>
                <ActivityIndicator color={WHITE} />
              </View>
            )}
          </TouchableOpacity>
          <Text style={styles.userName}>{fullName}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>Applicant</Text>
          </View>
          <View style={styles.photoActions}>
            <TouchableOpacity style={styles.photoBtn} onPress={handlePickPhoto} disabled={uploadingPhoto}>
              <Text style={styles.photoBtnText}>Change Photo</Text>
            </TouchableOpacity>
            {user?.profile_picture && (
              <TouchableOpacity style={styles.photoRemoveBtn} onPress={handleRemovePhoto} disabled={uploadingPhoto}>
                <Text style={styles.photoRemoveBtnText}>Remove</Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.photoHint}>JPG or PNG · Max 5 MB</Text>
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

        {/* ── Employment Status Update ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Employment Status</Text>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Current Status</Text>
            <Text style={styles.fieldValue}>
              {EMP_STATUS_LABELS[profile?.employment_status] || profile?.employment_status || 'Not set'}
            </Text>
          </View>

          {/* Latest request status */}
          {empStatusRequest?.has_request && (
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Change Request</Text>
              {empStatusRequest.status === 'pending' && (
                <View style={[styles.statusBadge, styles.badgePending]}>
                  <Text style={styles.badgePendingText}>Pending Review</Text>
                </View>
              )}
              {empStatusRequest.status === 'approved' && (
                <View style={[styles.statusBadge, styles.badgeApproved]}>
                  <Text style={styles.badgeApprovedText}>Approved</Text>
                </View>
              )}
              {empStatusRequest.status === 'rejected' && (
                <>
                  <View style={[styles.statusBadge, styles.badgeRejected]}>
                    <Text style={styles.badgeRejectedText}>Rejected</Text>
                  </View>
                  {!!empStatusRequest.rejection_reason && (
                    <Text style={styles.rejectionReason}>{empStatusRequest.rejection_reason}</Text>
                  )}
                </>
              )}
            </View>
          )}

          {/* Cooldown / next allowed info */}
          {empStatusRequest && !empStatusRequest.can_request && empStatusRequest.status !== 'pending' && (
            <Text style={styles.cooldownText}>
              Next update available: {empStatusRequest.next_allowed_date}
            </Text>
          )}

          <TouchableOpacity
            style={[
              styles.empStatusBtn,
              (!empStatusRequest?.can_request || empStatusRequest?.status === 'pending') && styles.btnDisabled,
            ]}
            onPress={() => {
              setNewEmpStatus('');
              setCoeDoc(null);
              setShowEmpStatusModal(true);
            }}
            disabled={!empStatusRequest?.can_request || empStatusRequest?.status === 'pending'}
          >
            <Text style={styles.empStatusBtnText}>Request Status Update</Text>
          </TouchableOpacity>
        </View>

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

      {/* ── Employment Status Update Modal ── */}
      <Modal
        visible={showEmpStatusModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEmpStatusModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Request Status Update</Text>
            <Text style={styles.modalSubtitle}>
              Select your new employment status and upload your Certificate of Employment (COE) as proof.
            </Text>

            <Text style={styles.fieldLabel}>New Employment Status</Text>
            <View style={styles.statusOptions}>
              {EMP_STATUS_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.statusOption,
                    newEmpStatus === opt.value && styles.statusOptionSelected,
                  ]}
                  onPress={() => setNewEmpStatus(opt.value)}
                >
                  <Text style={[
                    styles.statusOptionText,
                    newEmpStatus === opt.value && styles.statusOptionTextSelected,
                  ]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Certificate of Employment (COE)</Text>
            <TouchableOpacity style={styles.coeUploadBtn} onPress={handlePickCOE}>
              <Text style={styles.coeUploadBtnText}>
                {coeDoc ? 'Change COE Image' : 'Upload COE Image'}
              </Text>
            </TouchableOpacity>
            {coeDoc ? (
              <Text style={styles.coeFileName} numberOfLines={1}>
                {coeDoc.fileName || coeDoc.uri.split('/').pop()}
              </Text>
            ) : (
              <Text style={styles.photoHint}>JPG or PNG · Max 10 MB</Text>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowEmpStatusModal(false)}
                disabled={submittingEmpStatus}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmitBtn, submittingEmpStatus && styles.btnDisabled]}
                onPress={handleSubmitEmpStatusChange}
                disabled={submittingEmpStatus}
              >
                {submittingEmpStatus
                  ? <ActivityIndicator color={WHITE} size="small" />
                  : <Text style={styles.modalSubmitText}>Submit</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
    letterSpacing: 1.0, paddingRight: 1.0, textTransform: 'uppercase',
    opacity: 0.55, marginBottom: 14,
  },
  field:      { marginBottom: 14 },
  fieldRow:   { flexDirection: 'row' },
  fieldLabel: { fontSize: 11, color: MUTED, marginBottom: 4, fontFamily: 'Poppins_600SemiBold', textTransform: 'uppercase', letterSpacing: 0.4, paddingRight: 0.4 },
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
  modalSubtitle: { fontSize: 13, color: SECONDARY, marginBottom: 14, fontFamily: 'Poppins_400Regular' },

  // ── Employment Status ──
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20, marginTop: 4,
  },
  badgePending:       { backgroundColor: '#fef3c7' },
  badgePendingText:   { color: '#92400e', fontSize: 12, fontFamily: 'Poppins_600SemiBold' },
  badgeApproved:      { backgroundColor: '#d1fae5' },
  badgeApprovedText:  { color: '#065f46', fontSize: 12, fontFamily: 'Poppins_600SemiBold' },
  badgeRejected:      { backgroundColor: '#fee2e2' },
  badgeRejectedText:  { color: '#991b1b', fontSize: 12, fontFamily: 'Poppins_600SemiBold' },
  rejectionReason:    { fontSize: 12, color: '#991b1b', marginTop: 4, fontFamily: 'Poppins_400Regular' },
  cooldownText:       { fontSize: 12, color: MUTED, marginBottom: 8, fontFamily: 'Poppins_400Regular' },
  empStatusBtn: {
    backgroundColor: ACCENT,
    borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 6,
  },
  empStatusBtnText: { color: WHITE, fontSize: 14, fontFamily: 'Poppins_600SemiBold' },

  statusOptions:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 8 },
  statusOption: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1.5, borderColor: 'rgba(15,28,82,0.2)',
    backgroundColor: CARD_BG,
  },
  statusOptionSelected: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  statusOptionText:     { fontSize: 13, color: PRIMARY, fontFamily: 'Poppins_500Medium' },
  statusOptionTextSelected: { color: WHITE },
  coeUploadBtn: {
    borderWidth: 1.5, borderColor: ACCENT, borderStyle: 'dashed',
    borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 6,
  },
  coeUploadBtnText: { color: ACCENT, fontSize: 13, fontFamily: 'Poppins_600SemiBold' },
  coeFileName:      { fontSize: 12, color: SECONDARY, marginTop: 6, fontFamily: 'Poppins_400Regular' },

  // ── Profile Photo ──
  avatarWrapper: { position: 'relative', marginBottom: 14 },
  avatarImage: {
    width: 90, height: 90, borderRadius: 45,
    borderWidth: 3, borderColor: ACCENT,
  },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 45,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  photoActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  photoBtn: {
    paddingHorizontal: 16, paddingVertical: 7,
    backgroundColor: PRIMARY,
    borderRadius: 20,
  },
  photoBtnText: { color: WHITE, fontSize: 13, fontFamily: 'Poppins_600SemiBold' },
  photoRemoveBtn: {
    paddingHorizontal: 16, paddingVertical: 7,
    backgroundColor: '#fee2e2',
    borderRadius: 20,
  },
  photoRemoveBtnText: { color: '#991b1b', fontSize: 13, fontFamily: 'Poppins_600SemiBold' },
  photoHint: { fontSize: 11, color: MUTED, marginTop: 6, fontFamily: 'Poppins_400Regular' },
});
