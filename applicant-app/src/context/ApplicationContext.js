/**
 * Application Context
 * Manages loan application wizard state
 */

import React, { createContext, useContext, useReducer } from 'react';
import { hasExtraStep } from '../config/loanTypeConfig';

const ApplicationContext = createContext();

const initialState = {
  applicationId: null,
  currentStep: 1,
  totalSteps: 8,

  // Step 1: Loan Type
  loanType: null,
  selectedLoanType: null,
  coMakerRequirement: 0,

  // Step 2: Personal Details
  personalDetails: {
    contactNumber: '',
    secondaryContact: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    province: '',
    zipCode: '',
    // Personal information
    civilStatus: '',
    dateOfBirth: '',
    tin: '',
    // Employment
    employmentStatus: '',
    employerName: '',
    employerAddress: '',
    position: '',
    monthlyIncome: '',
    yearsEmployed: '',
    // Emergency contact
    emergencyContactName: '',
    emergencyContactNumber: '',
    emergencyContactRelationship: '',
  },

  // Step 3: Loan Details
  loanDetails: {
    amount: '',
    termMonths: '',
    purpose: '',
    installmentType: 'monthly',
    calculatedAmortization: null,
    calculatedTotal: null,
    calculatedInterest: null,
  },

  // Step 3b: Loan-type-specific extra fields (ATM, Gadget, LAD, Emergency)
  loanFormData: {},

  // Step 4: Co-Makers (conditional)
  coMakers: [],

  // Step 5: Documents
  documents: [],

  // Step 6: Face Verification
  faceVerification: {
    completed: false,
    imageUri: null,
    verified: false,
  },
  livenessCheck: {
    completed: false,
    method: null,
    verified: false,
  },

  // Validation state
  stepValidation: {
    1: false,
    2: false,
    3: false,
    4: null, // null = not applicable, true/false for applicable
    5: false,
    6: false,
    7: false,
  },

  // Error state
  errors: {},
};

function applicationReducer(state, action) {
  switch (action.type) {
    case 'SET_APPLICATION_ID':
      return { ...state, applicationId: action.payload };

    case 'SET_LOAN_TYPE':
      return {
        ...state,
        loanType: action.payload.loanType,
        selectedLoanType: action.payload.loanType,
        coMakerRequirement: action.payload.coMakerRequirement,
        stepValidation: {
          ...state.stepValidation,
          1: true,
          4: action.payload.coMakerRequirement > 0 ? false : null,
        },
      };

    case 'SET_PERSONAL_DETAILS':
      return {
        ...state,
        personalDetails: { ...state.personalDetails, ...action.payload },
      };

    case 'VALIDATE_PERSONAL_DETAILS':
      return {
        ...state,
        stepValidation: { ...state.stepValidation, 2: action.payload },
      };

    case 'SET_LOAN_DETAILS':
      return {
        ...state,
        loanDetails: { ...state.loanDetails, ...action.payload },
      };

    case 'VALIDATE_LOAN_DETAILS':
      return {
        ...state,
        stepValidation: { ...state.stepValidation, 3: action.payload },
      };

    case 'SET_LOAN_FORM_DATA':
      return {
        ...state,
        loanFormData: { ...state.loanFormData, ...action.payload },
      };

    case 'ADD_COMAKER':
      const newComakers = [...state.coMakers, action.payload];
      const comakersValid = newComakers.length >= state.coMakerRequirement;
      return {
        ...state,
        coMakers: newComakers,
        stepValidation: { ...state.stepValidation, 4: comakersValid },
      };

    case 'REMOVE_COMAKER':
      const filteredComakers = state.coMakers.filter(cm => cm.id !== action.payload);
      const stillValid = filteredComakers.length >= state.coMakerRequirement;
      return {
        ...state,
        coMakers: filteredComakers,
        stepValidation: { ...state.stepValidation, 4: stillValid },
      };

    case 'UPDATE_COMAKER':
      return {
        ...state,
        coMakers: state.coMakers.map(cm =>
          cm.id === action.payload.id ? { ...cm, ...action.payload.data } : cm
        ),
      };

    case 'SET_COMAKERS':
      return {
        ...state,
        coMakers: action.payload || [],
        stepValidation: {
          ...state.stepValidation,
          4: state.coMakerRequirement > 0
            ? (action.payload || []).length >= state.coMakerRequirement
            : null,
        },
      };

    case 'ADD_DOCUMENT':
      return {
        ...state,
        documents: [...state.documents, action.payload],
      };

    case 'REMOVE_DOCUMENT':
      return {
        ...state,
        documents: state.documents.filter(doc => doc.id !== action.payload),
      };

    case 'SET_DOCUMENTS':
      return {
        ...state,
        documents: action.payload || [],
      };

    case 'VALIDATE_DOCUMENTS':
      return {
        ...state,
        stepValidation: { ...state.stepValidation, 5: action.payload },
      };

    case 'SET_FACE_VERIFICATION':
      const faceValid = action.payload.completed && action.payload.verified;
      return {
        ...state,
        faceVerification: { ...state.faceVerification, ...action.payload },
        stepValidation: {
          ...state.stepValidation,
          6: faceValid && state.livenessCheck.verified,
        },
      };

    case 'SET_LIVENESS_CHECK':
      const livenessValid = action.payload.completed && action.payload.verified;
      return {
        ...state,
        livenessCheck: { ...state.livenessCheck, ...action.payload },
        stepValidation: {
          ...state.stepValidation,
          6: state.faceVerification.verified && livenessValid,
        },
      };

    case 'SET_STEP_VALID':
      return {
        ...state,
        stepValidation: { ...state.stepValidation, [action.payload.step]: action.payload.valid },
      };

    case 'SET_CURRENT_STEP':
      return { ...state, currentStep: action.payload };

    case 'SET_STEP':
      return { ...state, currentStep: action.payload };

    case 'SET_ERRORS':
      return { ...state, errors: { ...state.errors, ...action.payload } };

    case 'CLEAR_ERRORS':
      return { ...state, errors: {} };

    case 'RESET':
      return initialState;

    case 'RESET_APPLICATION':
      return initialState;

    case 'LOAD_APPLICATION':
      return {
        ...state,
        ...action.payload,
      };

    default:
      return state;
  }
}

export function ApplicationProvider({ children }) {
  const [state, dispatch] = useReducer(applicationReducer, initialState);

  // Helper functions
  const setLoanType = (loanType, coMakerRequirement) => {
    dispatch({
      type: 'SET_LOAN_TYPE',
      payload: { loanType, coMakerRequirement },
    });
  };

  const setPersonalDetails = (details) => {
    dispatch({ type: 'SET_PERSONAL_DETAILS', payload: details });
  };

  const setLoanDetails = (details) => {
    dispatch({ type: 'SET_LOAN_DETAILS', payload: details });
  };

  const setLoanFormData = (data) => {
    dispatch({ type: 'SET_LOAN_FORM_DATA', payload: data });
  };

  const addCoMaker = (comaker) => {
    dispatch({ type: 'ADD_COMAKER', payload: comaker });
  };

  const removeCoMaker = (comakerId) => {
    dispatch({ type: 'REMOVE_COMAKER', payload: comakerId });
  };

  const addDocument = (document) => {
    dispatch({ type: 'ADD_DOCUMENT', payload: document });
  };

  const removeDocument = (documentId) => {
    dispatch({ type: 'REMOVE_DOCUMENT', payload: documentId });
  };

  const setFaceVerification = (data) => {
    dispatch({ type: 'SET_FACE_VERIFICATION', payload: data });
  };

  const setLivenessCheck = (data) => {
    dispatch({ type: 'SET_LIVENESS_CHECK', payload: data });
  };

  const resetApplication = () => {
    dispatch({ type: 'RESET' });
  };

  const canProceedToStep = (stepNumber) => {
    // Check if all previous steps are valid
    for (let i = 1; i < stepNumber; i++) {
      const valid = state.stepValidation[i];
      // Skip null (not applicable) steps
      if (valid !== null && !valid) {
        return false;
      }
    }
    return true;
  };

  const getNextStep = (currentStep) => {
    if (currentStep === 3 && state.coMakerRequirement === 0) {
      return 5; // Skip co-maker step (LoanFormData navigates directly, not via this)
    }
    return currentStep + 1;
  };

  const getPreviousStep = (currentStep) => {
    if (currentStep === 5 && state.coMakerRequirement === 0) {
      return 3; // Skip co-maker step going back
    }
    return currentStep - 1;
  };

  /**
   * Returns the route name the wizard should navigate to after LoanDetails (step 3).
   * Accounts for the optional LoanFormData step and the conditional CoMaker step.
   */
  const getPostLoanDetailsRoute = () => {
    if (hasExtraStep(state.loanType?.loan_name)) return 'LoanFormData';
    if (state.coMakerRequirement > 0) return 'CoMaker';
    return 'DocumentUpload';
  };

  /**
   * Returns the route name LoanFormData should navigate to after saving.
   */
  const getPostLoanFormDataRoute = () => {
    if (state.coMakerRequirement > 0) return 'CoMaker';
    return 'DocumentUpload';
  };

  return (
    <ApplicationContext.Provider
      value={{
        state,
        dispatch,
        setLoanType,
        setPersonalDetails,
        setLoanDetails,
        setLoanFormData,
        addCoMaker,
        removeCoMaker,
        addDocument,
        removeDocument,
        setFaceVerification,
        setLivenessCheck,
        resetApplication,
        canProceedToStep,
        getNextStep,
        getPreviousStep,
        getPostLoanDetailsRoute,
        getPostLoanFormDataRoute,
      }}
    >
      {children}
    </ApplicationContext.Provider>
  );
}

export function useApplication() {
  const context = useContext(ApplicationContext);
  if (!context) {
    throw new Error('useApplication must be used within ApplicationProvider');
  }
  return context;
}

export default ApplicationContext;
