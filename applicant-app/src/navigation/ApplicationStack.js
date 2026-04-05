/**
 * Application Stack Navigator
 * Multi-step loan application wizard
 */

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { ApplicationProvider } from '../context/ApplicationContext';

// Wizard Screens
import SelectLoanTypeScreen from '../screens/application/SelectLoanTypeScreen';
import PersonalDetailsScreen from '../screens/application/PersonalDetailsScreen';
import LoanDetailsScreen from '../screens/application/LoanDetailsScreen';
import LoanFormDataScreen from '../screens/application/LoanFormDataScreen';
import CoMakerScreen from '../screens/application/CoMakerScreen';
import DocumentUploadScreen from '../screens/application/DocumentUploadScreen';
import FaceVerificationScreen from '../screens/application/FaceVerificationScreen';
import ReviewSubmitScreen from '../screens/application/ReviewSubmitScreen';

const Stack = createStackNavigator();

const screenOptions = {
  headerStyle: {
    backgroundColor: '#0f1c52',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(77,128,228,0.35)',
  },
  headerTintColor: '#ffffff',
  headerTitleStyle: {
    fontFamily: 'Poppins_600SemiBold',
  },
  headerBackTitle: 'Back',
  cardStyle: {
    backgroundColor: '#EEF4FF',
  },
};

function ApplicationStackNavigator() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="SelectLoanType"
        component={SelectLoanTypeScreen}
        options={{ title: 'Select Loan Type' }}
      />
      <Stack.Screen
        name="PersonalDetails"
        component={PersonalDetailsScreen}
        options={{ title: 'Personal Details' }}
      />
      <Stack.Screen
        name="LoanDetails"
        component={LoanDetailsScreen}
        options={{ title: 'Loan Details' }}
      />
      <Stack.Screen
        name="LoanFormData"
        component={LoanFormDataScreen}
        options={{ title: 'Loan Details' }}
      />
      <Stack.Screen
        name="CoMaker"
        component={CoMakerScreen}
        options={{ title: 'Co-Maker Information' }}
      />
      <Stack.Screen
        name="DocumentUpload"
        component={DocumentUploadScreen}
        options={{ title: 'Upload Documents' }}
      />
      <Stack.Screen
        name="FaceVerification"
        component={FaceVerificationScreen}
        options={{ title: 'Identity Verification' }}
      />
      <Stack.Screen
        name="ReviewSubmit"
        component={ReviewSubmitScreen}
        options={{ title: 'Review & Submit' }}
      />
    </Stack.Navigator>
  );
}

// Wrap with ApplicationProvider
export default function ApplicationStack() {
  return (
    <ApplicationProvider>
      <ApplicationStackNavigator />
    </ApplicationProvider>
  );
}
