/**
 * Application Context
 * Manages loan application wizard state
 */

import React, { createContext, useContext, useReducer } from 'react';

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
    addressLine1: '',
    city: '',
    province: '',
    zipCode: '',
    employerName: '',
    position: '',
    monthlyIncome: '',
  },

  // Step 3: Loan Details
  loanDetails: {
    amount: '',
    termMonths: '',
    purpose: '',
    calculatedAmortization: null,
    calculatedTotal: null,
    calculatedInterest: null,
  },

  // Step 4: Co-Makers (conditional)
  coMakers: [],

  // Step 5: Documents
  documents: [],

  // Step 6: Face Verification
  faceVerification: {
    completed: false,
    imageUri: null,
    verified: false,
    similarityScore: null,
    errorMessage: null,
    retryCount: 0,
  },
  livenessCheck: {
    completed: false,
    method: null,
    verified: false,
  },

  // Step 7: E-Signature
  eSignature: {
    completed: false,
    signatureUri: null,
    termsAccepted: false,
  },

  // OCR Data (from ID scan)
  ocrData: {
    scanned: false,
    idType: null,
    idTypeConfidence: 0,
    fullName: '',
    idNumber: '',
    birthdate: '',
    address: '',
    confidenceScores: {
      fullName: 0,
      idNumber: 0,
      birthdate: 0,
      address: 0,
    },
    overallConfidence: 0,
    imagePath: null,
    nameValidation: {
      match: true,
      similarity: 1,
      ocrName: '',
      profileName: '',
    },
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
    8: false,
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

    case 'SET_ESIGNATURE':
      const sigValid = action.payload.completed && action.payload.termsAccepted;
      return {
        ...state,
        eSignature: { ...state.eSignature, ...action.payload },
        stepValidation: { ...state.stepValidation, 7: sigValid },
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

    case 'SET_OCR_DATA':
      return {
        ...state,
        ocrData: {
          ...state.ocrData,
          scanned: true,
          idType: action.payload.id_type,
          idTypeConfidence: action.payload.id_type_confidence || 0,
          fullName: action.payload.extracted_data?.full_name || '',
          idNumber: action.payload.extracted_data?.id_number || '',
          birthdate: action.payload.extracted_data?.birthdate || '',
          address: action.payload.extracted_data?.address || '',
          confidenceScores: {
            fullName: action.payload.confidence_scores?.full_name || 0,
            idNumber: action.payload.confidence_scores?.id_number || 0,
            birthdate: action.payload.confidence_scores?.birthdate || 0,
            address: action.payload.confidence_scores?.address || 0,
          },
          overallConfidence: action.payload.overall_confidence || 0,
          imagePath: action.payload.image_path,
          nameValidation: action.payload.name_validation || state.ocrData.nameValidation,
          verified: false,
        },
      };

    case 'VERIFY_OCR_DATA':
      return {
        ...state,
        ocrData: {
          ...state.ocrData,
          verified: true,
        },
      };

    case 'CLEAR_OCR_DATA':
      return {
        ...state,
        ocrData: {
          scanned: false,
          idType: null,
          idTypeConfidence: 0,
          fullName: '',
          idNumber: '',
          birthdate: '',
          address: '',
          confidenceScores: {
            fullName: 0,
            idNumber: 0,
            birthdate: 0,
            address: 0,
          },
          overallConfidence: 0,
          imagePath: null,
          nameValidation: {
            match: true,
            similarity: 1,
            ocrName: '',
            profileName: '',
          },
          verified: false,
        },
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

  const setESignature = (data) => {
    dispatch({ type: 'SET_ESIGNATURE', payload: data });
  };

  const setOcrData = (data) => {
    dispatch({ type: 'SET_OCR_DATA', payload: data });
  };

  const verifyOcrData = () => {
    dispatch({ type: 'VERIFY_OCR_DATA' });
  };

  const clearOcrData = () => {
    dispatch({ type: 'CLEAR_OCR_DATA' });
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
    // Determine next step based on co-maker requirement
    if (currentStep === 3 && state.coMakerRequirement === 0) {
      return 5; // Skip co-maker step
    }
    return currentStep + 1;
  };

  const getPreviousStep = (currentStep) => {
    if (currentStep === 5 && state.coMakerRequirement === 0) {
      return 3; // Skip co-maker step
    }
    return currentStep - 1;
  };

  return (
    <ApplicationContext.Provider
      value={{
        state,
        dispatch,
        setLoanType,
        setPersonalDetails,
        setLoanDetails,
        addCoMaker,
        removeCoMaker,
        addDocument,
        removeDocument,
        setFaceVerification,
        setLivenessCheck,
        setESignature,
        setOcrData,
        verifyOcrData,
        clearOcrData,
        resetApplication,
        canProceedToStep,
        getNextStep,
        getPreviousStep,
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
