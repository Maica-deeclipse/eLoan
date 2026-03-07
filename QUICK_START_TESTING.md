# Quick Start Testing Guide

## 🚀 Get Started in 5 Minutes

### Option 1: Test Backend Directly (Fastest)

**1. Prepare Test Images**

Create a folder with test images:
```bash
mkdir backend/test_images
```

Then add two images:
- `test_images/id.jpg` - A photo of an ID card with a face
- `test_images/selfie.jpg` - A selfie photo

**2. Run Test Script**

```bash
cd backend
python test_face_verification.py test_images/id.jpg test_images/selfie.jpg
```

**What You'll See:**
```
🚀 Starting Face Verification Test...
============================================================
Testing Face Detection: id.jpg
============================================================
Success: True
Face Count: 1
Face Region: x=45, y=30, width=120, height=120
✅ Face detected successfully!

3️⃣  Comparing faces using DeepFace...
⏳ This may take 5-10 seconds on first run (downloading model)...

============================================================
📊 COMPARISON RESULTS
============================================================
✅ Success: True
🎯 Verified: True
📏 Distance: 0.245678
🎚️  Threshold: 0.680000
📊 Similarity: 87.34%
🤖 Model: ArcFace
📐 Distance Metric: cosine

📈 Similarity Bar:
   [████████████████████████████████████░░░░] 87.3%

🏁 VERDICT:
   ✅ PASS - Faces match! (≥80% threshold)
   Similarity: 87.3% (Required: 80%)
```

---

### Option 2: Test via Mobile App (Full Flow)

**1. Start Backend**
```bash
cd backend
python manage.py runserver
```

**2. Start Mobile App**
```bash
cd applicant-app
npm start
# Then: npm run android or npm run ios
```

**3. Test Flow**
- Login to the app
- Create new loan application
- **Step 5**: Upload ID photo
- **Step 6**: Capture selfie
- Watch for verification result

---

### Option 3: Use Webcam to Create Test Images (Quick Self-Test)

**1. Take Two Photos**

**Photo 1 - ID Photo Simulation:**
- Take a photo of yourself looking straight at camera
- Good lighting
- Neutral expression
- Save as `id_photo.jpg`

**Photo 2 - Selfie:**
- Take another photo of yourself
- Similar angle and lighting
- Can smile or neutral expression
- Save as `selfie.jpg`

**2. Test Comparison**
```bash
cd backend
python test_face_verification.py ../id_photo.jpg ../selfie.jpg
```

---

## 🧪 Quick Test Scenarios

### Test 1: Same Person (Should Pass)
```bash
# Use two photos of yourself
python test_face_verification.py your_id.jpg your_selfie.jpg
# Expected: Similarity >80%
```

### Test 2: Different People (Should Fail)
```bash
# Use photos of two different people
python test_face_verification.py person1_id.jpg person2_selfie.jpg
# Expected: Similarity <60%
```

### Test 3: Same Person, Poor Lighting
```bash
# Take one photo with good light, one with poor light
python test_face_verification.py good_light.jpg poor_light.jpg
# Expected: Similarity may drop to 70-85%
```

---

## 📸 Tips for Good Test Images

### For ID Photo:
- ✅ Clear, well-lit face
- ✅ Looking directly at camera
- ✅ Face takes up 30-50% of image
- ✅ No glare on photo
- ❌ Avoid: blurry, too dark, face too small

### For Selfie:
- ✅ Similar lighting to ID
- ✅ Facing camera directly
- ✅ Clear, in focus
- ✅ Good resolution
- ❌ Avoid: shadows, glare, multiple people

---

## 🔍 Understanding Results

### Similarity Scores:

| Score Range | Meaning | Verdict |
|-------------|---------|---------|
| 90-100% | Excellent match | ✅ PASS |
| 80-89% | Good match | ✅ PASS |
| 70-79% | Uncertain (borderline) | ❌ FAIL |
| 60-69% | Poor match | ❌ FAIL |
| 0-59% | No match | ❌ FAIL |

### Common Score Ranges:

- **Same person, ideal conditions**: 85-95%
- **Same person, different lighting**: 75-85%
- **Same person, years apart**: 70-80%
- **Different people**: 20-60%

---

## ⚡ Quick Troubleshooting

### "No module named 'cv2'"
```bash
pip install opencv-python deepface tf-keras tensorflow
```

### "No face detected"
- Check image quality (not too blurry)
- Ensure face is visible (not covered)
- Try different image

### Comparison too slow (>15 seconds)
- First run downloads model (~85MB) - this is normal
- Subsequent runs should be 2-5 seconds
- If still slow, check internet connection

### Similarity always low even for same person
- Check image quality (both should be clear)
- Ensure similar lighting conditions
- Try with good quality photos first

---

## 📊 Monitoring Backend Logs

When testing via mobile app, watch Django console for:

```python
# Face detection
Detecting face in: .../valid_id.jpg
Detected 1 face(s)

# Face extraction
Face extracted and saved to: .../id_face.jpg

# Comparison
Comparing faces: ID=..., Selfie=...
Comparison result: verified=True, similarity=87.5%

# Verdict
Face verification PASSED: 87.5% similarity
```

---

## 🎯 Success Checklist

Your system is working if:

- [ ] ✅ Backend test script runs without errors
- [ ] ✅ Same person photos: >80% similarity
- [ ] ✅ Different person photos: <60% similarity
- [ ] ✅ Mobile app completes verification
- [ ] ✅ Bookkeeper dashboard shows results
- [ ] ✅ Retry functionality works
- [ ] ✅ Processing time: 2-6 seconds (after first run)

---

## 📞 Need More Help?

See full testing guide: [FACE_VERIFICATION_TESTING_GUIDE.md](FACE_VERIFICATION_TESTING_GUIDE.md)

**Ready to test? Pick an option above and start! 🚀**
