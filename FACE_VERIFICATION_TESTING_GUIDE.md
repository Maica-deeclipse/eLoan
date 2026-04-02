# Face Verification Testing Guide

## 🧪 Comprehensive Testing Scenarios

This guide provides step-by-step testing scenarios to validate the face verification system.

---

## Prerequisites

### Before Testing:
1. ✅ Backend server running: `cd backend && python manage.py runserver`
2. ✅ Mobile app running: `cd applicant-app && npm start`
3. ✅ Have test ID documents ready (with clear faces)
4. ✅ Good lighting and camera access

---

## Test Scenario 1: Happy Path - Perfect Match

**Goal**: Verify successful face matching with high similarity

### Steps:
1. **Step 5 - Document Upload**:
   - Upload a clear government ID photo (driver's license, passport, etc.)
   - Ensure:
     - Face is clearly visible
     - Good lighting
     - No glare or shadows
     - Face takes up at least 30% of the image
   - Wait for OCR to complete

2. **Step 6 - Face Verification**:
   - Tap "Continue" to proceed to face verification
   - Read the instructions screen
   - Tap "Start Verification"
   - **When capturing selfie**:
     - Use the same person whose ID was uploaded
     - Face the camera directly
     - Ensure good lighting (face well-lit, no shadows)
     - Keep face within the oval guide
     - Wait for countdown (3 seconds)
   - Complete liveness checks (blink, smile, turn left, turn right)

### Expected Results:
- ✅ Similarity score: **85-100%**
- ✅ Status: "Verification Complete!"
- ✅ Green checkmark displayed
- ✅ Score bar shown in green
- ✅ Message: "Excellent match!" or "Good match"

### Backend Logs to Check:
```
Detecting face in: .../valid_id.jpg
Detected 1 face(s)
Face extracted and saved to: .../id_face.jpg
Detecting face in: .../selfie.jpg
Detected 1 face(s)
Comparing faces: ID=..., Selfie=...
Comparison result: verified=True, similarity=XX.X%
Face verification PASSED: XX.X% similarity
```

---

## Test Scenario 2: Different Person - Should Fail

**Goal**: Verify system rejects when faces don't match

### Steps:
1. **Step 5**: Upload ID of Person A
2. **Step 6**: Capture selfie of Person B (different person)

### Expected Results:
- ❌ Similarity score: **<80%** (likely <50%)
- ❌ Alert shown: "Face Verification Failed"
- ❌ Message includes:
  - "Similarity Score: XX.X%"
  - "Required: 80%"
  - Tips for retaking
- ❌ Retry button displayed
- ❌ Cannot proceed to Step 7

### What to Do:
- Tap "Retry" button
- Take selfie with correct person (Person A)
- Should now pass with >80% similarity

---

## Test Scenario 3: No Face in ID Document

**Goal**: Test error handling when ID has no detectable face

### Steps:
1. **Step 5**: Upload an ID document where:
   - Face is too small
   - Face is blurry/out of focus
   - Document is upside down
   - Or upload a non-ID document (e.g., blank paper)

2. **Step 6**: Attempt to capture selfie

### Expected Results:
- ❌ Error message: "No face detected in ID photo" or similar
- ❌ Face verification status: "Failed"
- ❌ Error details displayed
- ❌ Cannot proceed

### Backend Logs:
```
Detecting face in: .../valid_id.jpg
Detected 0 face(s)
No face detected in image
Failed to extract face from ID: No face detected in image
```

### Solution:
- Go back to Step 5
- Upload a clearer ID document
- Retry face verification

---

## Test Scenario 4: No Face in Selfie

**Goal**: Test error handling when selfie doesn't detect a face

### Steps:
1. **Step 5**: Upload valid ID
2. **Step 6**: Capture selfie with:
   - Camera pointing away from face
   - Face too far from camera
   - Face covered (mask, hand, etc.)
   - Very poor lighting (too dark)

### Expected Results:
- ❌ Error message: "We couldn't detect your face"
- ❌ Tips shown:
  - "Ensure good lighting"
  - "Face the camera directly"
  - "Remove obstructions"
- ❌ Retry button available

### Backend Logs:
```
Detecting face in: .../selfie.jpg
Detected 0 face(s)
No face detected in selfie
```

---

## Test Scenario 5: Low Similarity (70-79%)

**Goal**: Test borderline cases that should fail but are close

### Ways to Create This Scenario:
- Use photos from different years (aging)
- Different hairstyle/facial hair
- Wearing glasses in one but not the other
- Different facial expressions (serious vs smiling)
- One photo with makeup, one without

### Expected Results:
- ❌ Similarity score: **70-79%**
- ❌ Auto-reject (threshold is 80%)
- ❌ Error shown with score
- ✅ Can retry unlimited times

### Note:
If legitimate users frequently fall in 70-79% range, you can lower the threshold in settings:
```python
# backend/eloan_core/settings.py
FACE_VERIFICATION = {
    'AUTO_APPROVE_THRESHOLD': 75,  # Lower to 75 instead of 80
}
```

---

## Test Scenario 6: Poor Lighting Conditions

**Goal**: Test system behavior with challenging lighting

### Test Cases:

**A. Too Dark**:
- Turn off lights or cover camera partially
- Expected: May fail to detect face OR low similarity

**B. Too Bright (Glare)**:
- Point camera at light source
- Expected: May fail to detect face OR low similarity

**C. Uneven Lighting (Shadows)**:
- Half face in shadow
- Expected: May detect but lower similarity score

### Best Practice Tips to Show Users:
- Use natural light or indoor lighting
- Avoid direct sunlight on face (causes glare)
- Avoid backlighting (light behind you)
- Face should be evenly lit

---

## Test Scenario 7: Accessories Variation

**Goal**: Test how accessories affect matching

### Test Cases:

| ID Photo | Selfie | Expected Result |
|----------|--------|-----------------|
| No glasses | No glasses | ✅ High match (90%+) |
| Glasses | Glasses | ✅ Good match (85-95%) |
| No glasses | Glasses | ⚠️ Medium match (75-85%) |
| Glasses | No glasses | ⚠️ Medium match (75-85%) |
| Hat | No hat | ⚠️ Lower match (70-80%) |
| No facial hair | Beard | ⚠️ Lower match (65-80%) |

### Recommendation for Users:
If wearing glasses/hat in ID:
- Wear same accessories in selfie for best match
- Or remove glasses for both if possible

---

## Test Scenario 8: Multiple Faces in Image

**Goal**: Test system behavior with multiple people in frame

### Steps:
1. Upload ID with just one person (normal)
2. Capture selfie with multiple people in frame

### Expected Behavior:
- System uses **largest face** in the image
- If the largest face is NOT the ID owner → Match fails
- If ID owner is largest face → Should match

### Backend Logs:
```
Detected 3 face(s)
Multiple faces detected (3). Using largest face.
```

### Best Practice:
- Capture selfie alone (no one else in frame)

---

## Test Scenario 9: Retry Functionality

**Goal**: Test unlimited retry mechanism

### Steps:
1. Intentionally fail verification (different person or poor lighting)
2. Tap "Retry" button
3. Repeat multiple times (3-5 retries)

### Expected Results:
- ✅ Retry count increments in context state
- ✅ No limit on retries (can retry infinitely)
- ✅ Each retry triggers new face comparison
- ✅ Eventually can succeed with correct selfie

### Context State Check:
```javascript
state.faceVerification.retryCount // Should increment: 1, 2, 3...
```

---

## Test Scenario 10: Bookkeeper Dashboard Review

**Goal**: Verify bookkeeper can review verification results

### Steps:
1. Complete face verification on mobile app (any result)
2. Navigate to Frontend dashboard: `http://localhost:3000`
3. Login as bookkeeper
4. Go to Applications → Click on test application
5. Scroll to "Face Verification" section

### Expected Display:

**If Verification Passed:**
- ✅ Two images side-by-side (ID face vs Selfie)
- ✅ Similarity score in large green text (e.g., "85.5%")
- ✅ Progress bar showing score
- ✅ "MATCH" badge in green
- ✅ Face detection status: "✓ Detected" for both
- ✅ Model used: "ArcFace"
- ✅ Verification status: "Verified" (green badge)

**If Verification Failed:**
- ❌ Two images displayed (if captured)
- ❌ Similarity score in red text
- ❌ "NO MATCH" badge in red
- ❌ Error message shown in red box
- ❌ Verification status: "Failed" (red badge)

---

## Test Scenario 11: Edge Cases

### A. ID Document Not Uploaded
1. Skip Step 5 (don't upload ID)
2. Try Step 6 face verification

**Expected**: Error "ID document not found. Please upload your valid ID first."

### B. Very First Face Verification (Model Download)
1. First time running face verification after setup
2. DeepFace downloads ArcFace model (~85MB)

**Expected**:
- First verification takes ~10 seconds
- Subsequent verifications: 2-5 seconds
- Model saved to: `C:\Users\23011\.deepface\weights\`

### C. Network Timeout
1. Disconnect internet during face comparison
2. Or very slow connection

**Expected**: Error message with retry option

---

## Performance Benchmarks

### Expected Processing Times:

| Operation | Expected Time |
|-----------|---------------|
| Face detection in ID | 100-300ms |
| Face extraction from ID | 200-500ms |
| Face detection in selfie | 100-300ms |
| DeepFace comparison (first time) | 8-12 seconds |
| DeepFace comparison (subsequent) | 2-5 seconds |
| Total (first verification) | 10-15 seconds |
| Total (subsequent verifications) | 3-6 seconds |

---

## Troubleshooting Common Issues

### Issue 1: "ModuleNotFoundError: No module named 'cv2'"
**Solution**: Install dependencies
```bash
pip install opencv-python deepface tf-keras tensorflow
```

### Issue 2: Very Slow Face Comparison (>10 seconds every time)
**Cause**: DeepFace re-downloading model each time
**Solution**: Check if model exists at `~/.deepface/weights/arcface_weights.h5`

### Issue 3: TensorFlow Warnings in Console
**Note**: These are normal and can be ignored:
```
WARNING:tensorflow:From ... The name tf.losses.sparse_softmax_cross_entropy is deprecated...
```

### Issue 4: Similarity Always <60% Even for Same Person
**Possible Causes**:
- Very different image quality (ID vs selfie)
- Different ages (old ID photo)
- Extreme lighting differences
- Different facial expressions (serious vs smiling)

**Solutions**:
- Lower threshold to 70% in settings
- Ensure good lighting for selfie
- Update ID document if very old

### Issue 5: "Face detected in ID" but Comparison Fails
**Cause**: Face region extracted is too small or poor quality
**Solution**:
- Upload higher resolution ID document
- Ensure face is at least 30% of image

---

## Test Checklist

Use this checklist to track your testing:

- [ ] ✅ **Scenario 1**: Perfect match (same person, good conditions)
- [ ] ❌ **Scenario 2**: Different person (should fail)
- [ ] ❌ **Scenario 3**: No face in ID (should error)
- [ ] ❌ **Scenario 4**: No face in selfie (should error)
- [ ] ⚠️ **Scenario 5**: Low similarity 70-79% (should fail)
- [ ] 🌓 **Scenario 6**: Poor lighting (various conditions)
- [ ] 👓 **Scenario 7**: Accessories variation (glasses, hat)
- [ ] 👥 **Scenario 8**: Multiple faces in selfie
- [ ] 🔄 **Scenario 9**: Retry functionality (3+ retries)
- [ ] 📊 **Scenario 10**: Bookkeeper dashboard review
- [ ] 🔧 **Scenario 11**: Edge cases (missing ID, first run)

---

## Success Criteria

Your face verification system is working correctly if:

1. ✅ Same person with good conditions: **>85% similarity**
2. ❌ Different person: **<60% similarity** (auto-reject)
3. 🔍 Face detection works in 95%+ of clear photos
4. ⚡ Processing time: 3-6 seconds (after model loads)
5. 🔄 Retry works unlimited times
6. 📊 Bookkeeper dashboard shows all data correctly
7. ⚠️ Errors are clear and actionable

---

## Next Steps After Testing

Once testing is complete:

1. **Adjust threshold** if needed (currently 80%)
2. **Add logging** for production monitoring
3. **Consider async processing** if >5 second wait is too long
4. **Add email notifications** to applicants on verification status
5. **Create admin reports** for verification statistics

---

## Need Help?

If you encounter issues during testing:
1. Check Django console logs for detailed error messages
2. Check mobile app console for API response errors
3. Verify database migration applied: `python manage.py showmigrations loans`
4. Test API directly with Postman/curl for debugging

**Happy Testing! 🧪**
