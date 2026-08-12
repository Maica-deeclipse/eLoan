import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  FlatList,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApplication } from '../../context/ApplicationContext';
import applicationService from '../../services/applicationService';
import logger from '../../utils/logger';

const CoMakerScreen = ({ navigation }) => {
  const { state, dispatch, getRouteForStep } = useApplication();
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchTotal, setSearchTotal] = useState(0);
  const [searchOffset, setSearchOffset] = useState(0);
  const [searchHasMore, setSearchHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searching, setSearching] = useState(false);
  const [selectedCoMakers, setSelectedCoMakers] = useState(state.coMakers || []);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [addingCoMaker, setAddingCoMaker] = useState(null);

  const MAX_CO_MAKERS = 3;
  const getEffectiveRequiredCoMakers = (loanType, amount) => {
    const base = Number(loanType?.required_comakers || 0);
    const loanAmount = Number(amount || 0);

    if (loanAmount >= 50000) return Math.min(MAX_CO_MAKERS, Math.max(base, 3));
    if (loanAmount >= 25000) return Math.min(MAX_CO_MAKERS, Math.max(base, 2));
    if (loanAmount >= 10000) return Math.min(MAX_CO_MAKERS, Math.max(base, 1));
    return Math.max(base, 0);
  };

  const requiredCoMakers = getEffectiveRequiredCoMakers(
    state.selectedLoanType,
    state.loanDetails?.amount
  );
  const coMakerLimit = MAX_CO_MAKERS;

  useEffect(() => {
    // Initialize from state if available
    if (state.coMakers && state.coMakers.length > 0) {
      setSelectedCoMakers(state.coMakers);
    }
  }, []);

  const PAGE_SIZE = 20;

  const searchCoMakers = async (loadMore = false) => {
    if (searchQuery.trim().length < 2) {
      Alert.alert('Search', 'Please enter at least 2 characters to search');
      return;
    }

    const offset = loadMore ? searchOffset : 0;
    if (loadMore) {
      setLoadingMore(true);
    } else {
      setSearching(true);
      setSearchResults([]);
      setSearchOffset(0);
    }

    try {
      const data = await applicationService.searchUsers(searchQuery, offset, PAGE_SIZE);
      const filtered = data.users.filter(
        (user) => !selectedCoMakers.find((cm) => cm.user_id === user.id)
      );
      setSearchResults(prev => loadMore ? [...prev, ...filtered] : filtered);
      setSearchTotal(data.total);
      setSearchHasMore(data.has_more);
      setSearchOffset(offset + PAGE_SIZE);
    } catch (error) {
      logger.error('Search error:', error);
      Alert.alert('Error', 'Failed to search for co-makers');
    } finally {
      setSearching(false);
      setLoadingMore(false);
    }
  };

  const addCoMaker = async (user) => {
    if (selectedCoMakers.length >= coMakerLimit) {
      Alert.alert('Limit Reached', `You can only add up to ${coMakerLimit} co-makers in total.`);
      return;
    }

    if (selectedCoMakers.length >= requiredCoMakers) {
      Alert.alert('Maximum Reached', `This loan needs at least ${requiredCoMakers} co-maker(s) and no more than ${coMakerLimit} total.`);
      return;
    }

    setAddingCoMaker(user.id);
    try {
      // Add co-maker to the application
      const result = await applicationService.addCoMaker(state.applicationId, user.id);

      const newCoMaker = {
        id: result.id,
        user_id: user.id,
        full_name: user.full_name,
        email: user.email,
        contact_number: user.contact_number,
        status: result.status || 'pending',
      };

      const updatedCoMakers = [...selectedCoMakers, newCoMaker];
      setSelectedCoMakers(updatedCoMakers);
      dispatch({ type: 'SET_COMAKERS', payload: updatedCoMakers });

      // Remove from search results
      setSearchResults(searchResults.filter((r) => r.id !== user.id));

      Alert.alert('Success', `${user.full_name} has been added as a co-maker`);
    } catch (error) {
      logger.error('Add co-maker error:', error);
      Alert.alert('Error', error.response?.data?.error || 'Failed to add co-maker');
    } finally {
      setAddingCoMaker(null);
    }
  };

  const removeCoMaker = async (coMaker) => {
    Alert.alert(
      'Remove Co-Maker',
      `Are you sure you want to remove ${coMaker.full_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await applicationService.removeCoMaker(coMaker.id);
              const updatedCoMakers = selectedCoMakers.filter(
                (cm) => cm.user_id !== coMaker.user_id
              );
              setSelectedCoMakers(updatedCoMakers);
              dispatch({ type: 'SET_COMAKERS', payload: updatedCoMakers });
            } catch (error) {
              logger.error('Remove co-maker error:', error);
              Alert.alert('Error', 'Failed to remove co-maker');
            }
          },
        },
      ]
    );
  };

  const handleContinue = () => {
    if (selectedCoMakers.length < requiredCoMakers) {
      Alert.alert(
        'Co-Makers Required',
        `You need to add ${requiredCoMakers} co-maker(s) to continue. Currently you have ${selectedCoMakers.length}.`
      );
      return;
    }

    const rejected = selectedCoMakers.filter((cm) => cm.status === 'rejected');
    if (rejected.length > 0) {
      Alert.alert(
        'Co-Maker Rejected',
        `${rejected.map((cm) => cm.full_name).join(', ')} rejected the request. Please remove them and add a new co-maker.`
      );
      return;
    }

    // Capture before dispatch
    const highestStepReached = state.currentStep;

    dispatch({ type: 'SET_STEP', payload: 5 });

    // Smart-forward: if the user came back from FaceVerification or later, jump there
    if (highestStepReached >= 6) {
      navigation.navigate(getRouteForStep(highestStepReached));
    } else {
      navigation.navigate('DocumentUpload');
    }
  };

  const renderSearchResult = ({ item }) => (
    <View style={styles.searchResultItem}>
      <View style={styles.searchResultInfo}>
        <Text style={styles.searchResultName}>{item.full_name}</Text>
        <Text style={styles.searchResultEmail}>{item.email}</Text>
        {item.contact_number && (
          <Text style={styles.searchResultContact}>{item.contact_number}</Text>
        )}
      </View>
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => addCoMaker(item)}
        disabled={addingCoMaker === item.id}
      >
        {addingCoMaker === item.id ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Ionicons name="add" size={24} color="#fff" />
        )}
      </TouchableOpacity>
    </View>
  );

  const renderSelectedCoMaker = (coMaker, index) => (
    <View key={coMaker.user_id} style={styles.selectedCoMakerCard}>
      <View style={styles.coMakerHeader}>
        <View style={styles.coMakerNumber}>
          <Text style={styles.coMakerNumberText}>{index + 1}</Text>
        </View>
        <View style={styles.coMakerInfo}>
          <Text style={styles.coMakerRank}>Co-Maker Rank {index + 1}</Text>
          <Text style={styles.coMakerName}>{coMaker.full_name}</Text>
          <Text style={styles.coMakerEmail}>{coMaker.email}</Text>
          {coMaker.contact_number && (
            <Text style={styles.coMakerContact}>{coMaker.contact_number}</Text>
          )}
        </View>
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => removeCoMaker(coMaker)}
        >
          <Ionicons name="close-circle" size={28} color="#dc3545" />
        </TouchableOpacity>
      </View>
      <View style={styles.coMakerStatus}>
        <View
          style={[
            styles.statusBadge,
            coMaker.status === 'accepted'
              ? styles.statusApproved
              : coMaker.status === 'rejected'
                ? styles.statusRejected
                : styles.statusPending,
          ]}
        >
          <Text
            style={[
              styles.statusText,
              coMaker.status === 'rejected' && styles.statusTextDanger,
            ]}
          >
            {coMaker.status === 'accepted'
              ? 'Accepted'
              : coMaker.status === 'rejected'
                ? 'Rejected'
                : 'Pending Consent'}
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Progress Indicator */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: '50%' }]} />
        </View>
        <Text style={styles.progressText}>Step 4 of 8</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Co-Makers</Text>
        <Text style={styles.subtitle}>
          This loan requires at least {requiredCoMakers} co-maker(s). Higher loan amounts may require a higher co-maker rank, and the total co-maker limit is {coMakerLimit}.
        </Text>

        {/* Selected Co-Makers */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Selected Co-Makers ({selectedCoMakers.length}/{coMakerLimit})
          </Text>

          {selectedCoMakers.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={48} color="#ccc" />
              <Text style={styles.emptyStateText}>No co-makers added yet</Text>
              <Text style={styles.emptyStateSubtext}>
                Search and add co-makers below
              </Text>
            </View>
          ) : (
            selectedCoMakers.map((coMaker, index) =>
              renderSelectedCoMaker(coMaker, index)
            )
          )}
        </View>

        {/* Add Co-Maker Button */}
        {selectedCoMakers.length < coMakerLimit && (
          <TouchableOpacity
            style={styles.searchButton}
            onPress={() => setShowSearchModal(true)}
          >
            <Ionicons name="search" size={20} color="#fff" />
            <Text style={styles.searchButtonText}>Search for Co-Maker</Text>
          </TouchableOpacity>
        )}

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={24} color="#0d6efd" />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>About Co-Makers</Text>
            <Text style={styles.infoText}>
              {'\u2022'} Co-makers serve as guarantors for your loan{'\n'}
              {'\u2022'} They must be registered cooperative members{'\n'}
              {'\u2022'} They will receive a notification to provide consent{'\n'}
              {'\u2022'} Your application will proceed once they consent
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Navigation Buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={20} color="#666" />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.continueButton,
            selectedCoMakers.length < requiredCoMakers && styles.continueButtonDisabled,
          ]}
          onPress={handleContinue}
          disabled={loading || selectedCoMakers.length < requiredCoMakers}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.continueButtonText}>Continue</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Search Modal */}
      <Modal
        visible={showSearchModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowSearchModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Search Co-Maker</Text>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => {
                setShowSearchModal(false);
                setSearchQuery('');
                setSearchResults([]);
                setSearchTotal(0);
                setSearchOffset(0);
                setSearchHasMore(false);
              }}
            >
              <Ionicons name="close" size={28} color="#333" />
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <View style={styles.searchInputContainer}>
              <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by name or email..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={searchCoMakers}
                autoFocus
              />
            </View>
            <TouchableOpacity
              style={styles.searchActionButton}
              onPress={searchCoMakers}
              disabled={searching}
            >
              {searching ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.searchActionButtonText}>Search</Text>
              )}
            </TouchableOpacity>
          </View>

          {searchResults.length > 0 ? (
            <FlatList
              data={searchResults}
              renderItem={renderSearchResult}
              keyExtractor={(item) => item.id.toString()}
              style={styles.searchResultsList}
              contentContainerStyle={styles.searchResultsContent}
              ListHeaderComponent={
                <Text style={styles.resultCount}>
                  Showing {searchResults.length} of {searchTotal} result{searchTotal !== 1 ? 's' : ''}
                </Text>
              }
              ListFooterComponent={
                searchHasMore ? (
                  <TouchableOpacity
                    style={styles.loadMoreButton}
                    onPress={() => searchCoMakers(true)}
                    disabled={loadingMore}
                  >
                    {loadingMore ? (
                      <ActivityIndicator size="small" color="#0d6efd" />
                    ) : (
                      <Text style={styles.loadMoreText}>Load more results</Text>
                    )}
                  </TouchableOpacity>
                ) : null
              }
            />
          ) : (
            <View style={styles.modalEmptyState}>
              {searchQuery.length > 0 && !searching ? (
                <>
                  <Ionicons name="search" size={48} color="#ccc" />
                  <Text style={styles.modalEmptyText}>No results found</Text>
                  <Text style={styles.modalEmptySubtext}>
                    Try a different search term
                  </Text>
                </>
              ) : (
                <>
                  <Ionicons name="people" size={48} color="#ccc" />
                  <Text style={styles.modalEmptyText}>Search for members</Text>
                  <Text style={styles.modalEmptySubtext}>
                    Enter a name or email to find potential co-makers
                  </Text>
                </>
              )}
            </View>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  progressContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#e9ecef',
    borderRadius: 3,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#0d6efd',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: '#6c757d',
    textAlign: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 24,
    fontFamily: 'Poppins_700Bold',
    color: '#212529',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6c757d',
    lineHeight: 20,
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Poppins_600SemiBold',
    color: '#495057',
    marginBottom: 12,
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#dee2e6',
  },
  emptyStateText: {
    fontSize: 16,
    fontFamily: 'Poppins_600SemiBold',
    color: '#6c757d',
    marginTop: 12,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#adb5bd',
    marginTop: 4,
  },
  selectedCoMakerCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  coMakerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  coMakerNumber: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0d6efd',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  coMakerNumberText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Poppins_700Bold',
  },
  coMakerInfo: {
    flex: 1,
  },
  coMakerRank: {
    fontSize: 11,
    color: '#0d6efd',
    fontFamily: 'Poppins_600SemiBold',
    marginBottom: 4,
  },
  coMakerName: {
    fontSize: 16,
    fontFamily: 'Poppins_600SemiBold',
    color: '#212529',
  },
  coMakerEmail: {
    fontSize: 14,
    color: '#6c757d',
    marginTop: 2,
  },
  coMakerContact: {
    fontSize: 14,
    color: '#6c757d',
  },
  removeButton: {
    padding: 4,
  },
  coMakerStatus: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusPending: {
    backgroundColor: '#fff3cd',
  },
  statusApproved: {
    backgroundColor: '#d4edda',
  },
  statusRejected: {
    backgroundColor: '#f8d7da',
  },
  statusText: {
    fontSize: 12,
    fontFamily: 'Poppins_600SemiBold',
    color: '#856404',
  },
  statusTextDanger: {
    color: '#842029',
  },
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0d6efd',
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 24,
  },
  searchButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Poppins_600SemiBold',
    marginLeft: 8,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#e7f1ff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoTitle: {
    fontSize: 14,
    fontFamily: 'Poppins_600SemiBold',
    color: '#0d6efd',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: '#495057',
    lineHeight: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dee2e6',
    marginRight: 12,
  },
  backButtonText: {
    color: '#666',
    fontSize: 16,
    fontFamily: 'Poppins_600SemiBold',
    marginLeft: 4,
  },
  continueButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0d6efd',
    paddingVertical: 14,
    borderRadius: 12,
  },
  continueButtonDisabled: {
    backgroundColor: '#adb5bd',
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Poppins_600SemiBold',
    marginRight: 8,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Poppins_700Bold',
    color: '#212529',
  },
  modalCloseButton: {
    padding: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginRight: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 12,
    color: '#212529',
  },
  searchActionButton: {
    backgroundColor: '#0d6efd',
    paddingHorizontal: 20,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchActionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Poppins_600SemiBold',
  },
  searchResultsList: {
    flex: 1,
  },
  searchResultsContent: {
    padding: 20,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  searchResultInfo: {
    flex: 1,
  },
  searchResultName: {
    fontSize: 16,
    fontFamily: 'Poppins_600SemiBold',
    color: '#212529',
  },
  searchResultEmail: {
    fontSize: 14,
    color: '#6c757d',
    marginTop: 2,
  },
  searchResultContact: {
    fontSize: 14,
    color: '#6c757d',
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#28a745',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalEmptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  modalEmptyText: {
    fontSize: 18,
    fontFamily: 'Poppins_600SemiBold',
    color: '#6c757d',
    marginTop: 16,
  },
  modalEmptySubtext: {
    fontSize: 14,
    color: '#adb5bd',
    marginTop: 8,
    textAlign: 'center',
  },
  resultCount: {
    fontSize: 13,
    color: '#6c757d',
    marginBottom: 12,
  },
  loadMoreButton: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 4,
  },
  loadMoreText: {
    fontSize: 14,
    color: '#0d6efd',
    fontFamily: 'Poppins_600SemiBold',
  },
});

export default CoMakerScreen;
