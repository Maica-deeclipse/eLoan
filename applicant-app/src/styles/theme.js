/**
 * Centralized Theme & Styles for eLoan Applicant App
 *
 * Usage:
 *   import { colors, typography, spacing, shadows, commonStyles } from '../styles/theme';
 *
 *   // In your component:
 *   <View style={commonStyles.container}>
 *   <Text style={[typography.title, { color: colors.primary }]}>
 */

import { StyleSheet, Platform } from 'react-native';

// =============================================================================
// COLORS - eLoan Brand Colors
// =============================================================================
export const colors = {
  // Primary Brand Colors
  primary: 'rgba(255, 255, 255, 0.98)', // White
  primaryDark: '#f5f5f5',
  primaryLight: '#ffffff',
  primaryBg: '#fafafa',

  // Secondary Brand Color (Main Action Color)
  secondary: '#02327a', // Dark Blue
  secondaryDark: '#011e4a',
  secondaryLight: '#034199',
  secondaryBg: '#e6eaf2',

  // Status Colors
  success: '#28a745',
  successDark: '#218838',
  successLight: '#48c664',
  successBg: '#d4edda',

  warning: '#ff9800',
  warningDark: '#e68900',
  warningLight: '#ffad33',
  warningBg: '#fff3cd',

  danger: '#dc3545',
  dangerDark: '#c82333',
  dangerLight: '#e35d6a',
  dangerBg: '#f8d7da',

  info: '#02327a', // Use brand color for info
  infoDark: '#011e4a',
  infoLight: '#034199',
  infoBg: '#e6eaf2',

  // Neutral Colors
  white: '#ffffff',
  black: '#000000',

  // Grays
  gray100: '#f8f9fa',
  gray200: '#e9ecef',
  gray300: '#dee2e6',
  gray400: '#ced4da',
  gray500: '#adb5bd',
  gray600: '#6c757d',
  gray700: '#495057',
  gray800: '#343a40',
  gray900: '#212529',

  // Text Colors
  textPrimary: '#212529',
  textSecondary: '#6c757d',
  textMuted: '#adb5bd',
  textLight: '#ffffff',
  textOnPrimary: '#02327a', // Text on white background
  textOnSecondary: '#ffffff', // Text on dark blue background

  // Background Colors
  background: '#f8f9fa',
  backgroundWhite: 'rgba(255, 255, 255, 0.98)',
  backgroundDark: '#02327a',

  // Border Colors
  border: '#dee2e6',
  borderLight: '#e9ecef',
  borderDark: '#ced4da',

  // Overlay
  overlay: 'rgba(2, 50, 122, 0.5)', // Dark blue overlay
  overlayLight: 'rgba(2, 50, 122, 0.3)',
};

// =============================================================================
// SPACING
// =============================================================================
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,

  // Specific use cases
  screenPadding: 20,
  cardPadding: 16,
  inputPadding: 12,
  buttonPadding: 14,
};

// =============================================================================
// TYPOGRAPHY
// =============================================================================
export const fontSizes = {
  xs: 11,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 20,
  xxxl: 24,
  title: 28,
  header: 32,
};

export const fontWeights = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
};

export const typography = StyleSheet.create({
  // Headings
  header: {
    fontSize: fontSizes.header,
    fontWeight: fontWeights.bold,
    color: colors.textPrimary,
  },
  title: {
    fontSize: fontSizes.title,
    fontWeight: fontWeights.bold,
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.semibold,
    color: colors.textPrimary,
  },
  sectionTitle: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
    color: colors.textPrimary,
  },

  // Body Text
  body: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.regular,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  bodySmall: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.regular,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  bodyLarge: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.regular,
    color: colors.textPrimary,
    lineHeight: 24,
  },

  // Labels
  label: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.medium,
    color: colors.textPrimary,
  },
  labelSmall: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    color: colors.textSecondary,
  },

  // Caption & Helper Text
  caption: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.regular,
    color: colors.textMuted,
  },
  helper: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.regular,
    color: colors.textSecondary,
    lineHeight: 16,
  },

  // Button Text
  buttonText: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
  },
  buttonTextSmall: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
  },

  // Link Text
  link: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.medium,
    color: colors.primary,
  },
});

// =============================================================================
// SHADOWS
// =============================================================================
export const shadows = {
  sm: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  lg: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  xl: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
};

// =============================================================================
// BORDER RADIUS
// =============================================================================
export const borderRadius = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 20,
  round: 9999,
};

// =============================================================================
// COMMON STYLES
// =============================================================================
export const commonStyles = StyleSheet.create({
  // Containers
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  containerWhite: {
    flex: 1,
    backgroundColor: colors.white,
  },
  screenPadding: {
    paddingHorizontal: spacing.screenPadding,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Cards
  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.cardPadding,
    ...shadows.md,
  },
  cardFlat: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.cardPadding,
    borderWidth: 1,
    borderColor: colors.border,
  },

  // Rows
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Text Containers (Prevents text cutoff)
  textContainer: {
    flex: 1,
  },
  textContainerWithMargin: {
    flex: 1,
    marginLeft: spacing.md,
  },

  // Dividers
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  dividerLight: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: spacing.sm,
  },

  // Progress Bar
  progressContainer: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  progressBar: {
    height: 6,
    backgroundColor: colors.gray200,
    borderRadius: borderRadius.xs,
    marginBottom: spacing.sm,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.secondary, // #02327a
    borderRadius: borderRadius.xs,
  },
  progressText: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});

// =============================================================================
// BUTTON STYLES
// =============================================================================
export const buttonStyles = StyleSheet.create({
  // Base Button
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.buttonPadding,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.lg,
  },

  // Primary Button (Dark Blue)
  primary: {
    backgroundColor: colors.secondary, // #02327a
  },
  primaryText: {
    color: colors.white,
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
  },
  primaryDisabled: {
    backgroundColor: colors.gray500,
  },

  // Secondary/Outline Button
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryText: {
    color: colors.textSecondary,
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
  },

  // Success Button
  success: {
    backgroundColor: colors.success,
  },
  successText: {
    color: colors.white,
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
  },

  // Danger Button
  danger: {
    backgroundColor: colors.danger,
  },
  dangerText: {
    color: colors.white,
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
  },

  // Ghost Button (text only)
  ghost: {
    backgroundColor: 'transparent',
    paddingVertical: spacing.sm,
  },
  ghostText: {
    color: colors.primary,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
  },

  // Small Button
  small: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
  },
  smallText: {
    fontSize: fontSizes.sm,
  },

  // Full Width
  fullWidth: {
    width: '100%',
  },
});

// =============================================================================
// INPUT STYLES
// =============================================================================
export const inputStyles = StyleSheet.create({
  // Container
  container: {
    marginBottom: spacing.lg,
  },

  // Label
  label: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.medium,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  labelRequired: {
    color: colors.danger,
  },

  // Input Field
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.inputPadding,
    paddingVertical: spacing.inputPadding,
    fontSize: fontSizes.lg,
    color: colors.textPrimary,
    backgroundColor: colors.white,
  },
  inputFocused: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  inputError: {
    borderColor: colors.danger,
  },
  inputDisabled: {
    backgroundColor: colors.gray100,
    color: colors.textMuted,
  },

  // Helper/Error Text
  helperText: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  errorText: {
    fontSize: fontSizes.sm,
    color: colors.danger,
    marginTop: spacing.xs,
  },

  // Textarea
  textarea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
});

// =============================================================================
// BADGE STYLES
// =============================================================================
export const badgeStyles = StyleSheet.create({
  base: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  text: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.semibold,
  },

  // Variants
  primary: {
    backgroundColor: colors.primaryBg,
  },
  primaryText: {
    color: colors.primary,
  },

  success: {
    backgroundColor: colors.successBg,
  },
  successText: {
    color: colors.success,
  },

  warning: {
    backgroundColor: colors.warningBg,
  },
  warningText: {
    color: colors.warningDark,
  },

  danger: {
    backgroundColor: colors.dangerBg,
  },
  dangerText: {
    color: colors.danger,
  },

  info: {
    backgroundColor: colors.infoBg,
  },
  infoText: {
    color: colors.info,
  },

  neutral: {
    backgroundColor: colors.gray200,
  },
  neutralText: {
    color: colors.textSecondary,
  },
});

// =============================================================================
// MODAL STYLES
// =============================================================================
export const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.screenPadding,
  },
  overlayBottom: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    padding: spacing.xxl,
    width: '100%',
    maxWidth: 400,
  },
  containerBottom: {
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius.xxl,
    borderTopRightRadius: borderRadius.xxl,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: fontSizes.xxl,
    fontWeight: fontWeights.bold,
    color: colors.textPrimary,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.round,
    backgroundColor: colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    paddingVertical: spacing.md,
  },
  footer: {
    flexDirection: 'row',
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.lg,
  },
});

// =============================================================================
// LIST STYLES
// =============================================================================
export const listStyles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.cardPadding,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  itemLast: {
    borderBottomWidth: 0,
  },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primaryBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.medium,
    color: colors.textPrimary,
  },
  itemSubtitle: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  itemAction: {
    marginLeft: spacing.sm,
  },
});

// =============================================================================
// ALERT/INFO BOX STYLES
// =============================================================================
export const alertStyles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    borderRadius: borderRadius.lg,
    padding: spacing.cardPadding,
  },
  icon: {
    marginRight: spacing.md,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    marginBottom: spacing.xs,
  },
  message: {
    fontSize: fontSizes.sm,
    lineHeight: 18,
  },

  // Variants
  success: {
    backgroundColor: colors.successBg,
  },
  successTitle: {
    color: colors.success,
  },
  successMessage: {
    color: colors.gray700,
  },

  warning: {
    backgroundColor: colors.warningBg,
  },
  warningTitle: {
    color: colors.warningDark,
  },
  warningMessage: {
    color: colors.gray700,
  },

  danger: {
    backgroundColor: colors.dangerBg,
  },
  dangerTitle: {
    color: colors.danger,
  },
  dangerMessage: {
    color: colors.gray700,
  },

  info: {
    backgroundColor: colors.infoBg,
  },
  infoTitle: {
    color: colors.info,
  },
  infoMessage: {
    color: colors.gray700,
  },
});

// =============================================================================
// FORM SECTION STYLES
// =============================================================================
export const formStyles = StyleSheet.create({
  section: {
    marginBottom: spacing.xxl,
  },
  sectionTitle: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  sectionDescription: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    lineHeight: 18,
  },
  row: {
    flexDirection: 'row',
    marginHorizontal: -spacing.sm,
  },
  col: {
    flex: 1,
    paddingHorizontal: spacing.sm,
  },
});

// =============================================================================
// NAVIGATION BUTTON CONTAINER
// =============================================================================
export const navButtonStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: spacing.lg,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.buttonPadding,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.md,
  },
  backButtonText: {
    color: colors.textSecondary,
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
    marginLeft: spacing.xs,
  },
  nextButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.buttonPadding,
    borderRadius: borderRadius.lg,
  },
  nextButtonDisabled: {
    backgroundColor: colors.gray500,
  },
  nextButtonText: {
    color: colors.white,
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
    marginRight: spacing.xs,
  },
});

// =============================================================================
// EXPORT DEFAULT
// =============================================================================
export default {
  colors,
  spacing,
  fontSizes,
  fontWeights,
  typography,
  shadows,
  borderRadius,
  commonStyles,
  buttonStyles,
  inputStyles,
  badgeStyles,
  modalStyles,
  listStyles,
  alertStyles,
  formStyles,
  navButtonStyles,
};
