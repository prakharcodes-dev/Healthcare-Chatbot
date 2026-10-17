# Symptom Matcher — Evaluation Results

> Generated: 2026-10-17 19:17  
> Dataset: `data/diseases.json` (727 diseases)  
> Test cases: `evaluation/test_cases.json` (60 cases)

---

## Overall Accuracy

| Metric | Score | Hits / Total |
|--------|-------|--------------|
| Top-1 Accuracy | **65.0%** | 39 / 60 |
| Top-3 Accuracy | **81.7%** | 49 / 60 |
| Top-5 Accuracy | **83.3%** | 50 / 60 |

---

## Accuracy by Test Type

| Type | n | Top-1 | Top-3 | Top-5 |
|------|---|-------|-------|-------|
| Exact symptoms | 40 | 77.5% | 92.5% | 92.5% |
| Partial symptoms (2 of N) | 10 | 30.0% | 50.0% | 50.0% |
| Typo symptoms | 10 | 50.0% | 70.0% | 80.0% |

---

## Worst Failures (not in Top-5)

| # | Type | Expected Disease | Input Symptoms | Top-5 Returned |
|---|------|-----------------|----------------|----------------|
| 1 | exact | Kunjin Virus Encephalitis | headache; fever; fatigue | Tick-borne Encephalitis; Tick-borne Encephalitis; Alfuy Virus Infection; Anhanga Virus; Apeu Virus |
| 2 | exact | Chikungunya | severe joint pain (especially hands/feet); fatigue; headache; sudden high fever | Apeu Virus; Babanki Virus; Babanki Virus Infection; Cacipacore Virus; Capim Virus |
| 3 | exact | Shokwe Virus | fever; fatigue; encephalitis | Tick-borne Encephalitis; Tick-borne Encephalitis; Alfuy Virus Infection; Apeu Virus; Cacipacore Virus |
| 4 | partial | Sindbis Virus Disease (Ockelbo, Pogosta, Karelian Fever) | fever; rash | Sagiyama Virus; Sagiyama Virus Infection; Syphilis; Alfuy Virus Infection; Anhanga Virus |
| 5 | partial | Scrub Typhus (Tsutsugamushi Disease) | eschar at bite site; high fever | Tick-borne Lymphadenopathy; Flinders Island Spotted Fever; Japanese Spotted Fever; Mediterranean Spotted Fever; Rickettsialpox |
| 6 | partial | Trichuriasis (Whipworm) | often asymptomatic; abdominal pain | Hymenolepiasis (Dwarf Tapeworm); Trichostrongyliasis; Balantidiasis; Blastocystosis; Hymenolepiasis nana |
| 7 | partial | Bourbon Virus Disease | fever; fatigue | Tick-borne Encephalitis; Tick-borne Encephalitis; Sagiyama Virus; Sagiyama Virus Infection; Syphilis |
| 8 | partial | Chronic Obstructive Pulmonary Disease (COPD) | chronic progressive shortness of breath; persistent cough with sputum | COPD; Pneumonia; Black Lung Disease (Coal Workers' Pneumoconiosis); Pleurisy (Pleuritis); Sporotrichosis |
| 9 | typo | Kyungpook Virus Infection | faver; joint pain; rash | Babanki Virus; Babanki Virus Infection; Igbo-Ora Virus; Igbo-Ora Virus Infection; Kokobera Virus |
| 10 | typo | Getah Virus | mescle pain; rash; fever | Igbo-Ora Virus; Igbo-Ora Virus Infection; Dengue; Barmah Forest Virus; Barmah Forest Virus Infection |

---

## All Test Case Results

| ID | Type | Expected | Top-1 | Top-3 | Top-5 | Rank-1 Returned |
|----|------|----------|-------|-------|-------|----------------|
| 1 | exact | Interstitial Cystitis | ✅ | ✅ | ✅ | Interstitial Cystitis |
| 2 | exact | Common Cold | ❌ | ✅ | ✅ | Rhinovirus |
| 3 | exact | Anencephaly | ✅ | ✅ | ✅ | Anencephaly |
| 4 | exact | Marburg Virus Disease | ✅ | ✅ | ✅ | Marburg Virus Disease |
| 5 | exact | Kunjin Virus Encephalitis | ❌ | ❌ | ❌ | Tick-borne Encephalitis |
| 6 | exact | Hyperthyroidism | ❌ | ✅ | ✅ | Graves' Disease |
| 7 | exact | Diphtheria | ✅ | ✅ | ✅ | Diphtheria |
| 8 | exact | Chronic Bronchitis | ✅ | ✅ | ✅ | Chronic Bronchitis |
| 9 | exact | Pleurisy | ✅ | ✅ | ✅ | Pleurisy |
| 10 | exact | Brugada Syndrome | ✅ | ✅ | ✅ | Brugada Syndrome |
| 11 | exact | Cervical Cancer | ✅ | ✅ | ✅ | Cervical Cancer |
| 12 | exact | Heat Stroke | ✅ | ✅ | ✅ | Heat Stroke |
| 13 | exact | Rosacea | ✅ | ✅ | ✅ | Rosacea |
| 14 | exact | Apeu Virus | ❌ | ✅ | ✅ | Anhanga Virus |
| 15 | exact | Anthrax | ✅ | ✅ | ✅ | Anthrax |
| 16 | exact | Chikungunya | ❌ | ❌ | ❌ | Apeu Virus |
| 17 | exact | Hydatid Disease (Echinococcosis) | ✅ | ✅ | ✅ | Hydatid Disease (Echinococcosis) |
| 18 | exact | Insomnia | ✅ | ✅ | ✅ | Insomnia |
| 19 | exact | Uterine Fibroids | ✅ | ✅ | ✅ | Uterine Fibroids |
| 20 | exact | Juvenile Idiopathic Arthritis | ✅ | ✅ | ✅ | Juvenile Idiopathic Arthritis |
| 21 | exact | Anhanga Virus | ✅ | ✅ | ✅ | Anhanga Virus |
| 22 | exact | Cryoglobulinemia | ✅ | ✅ | ✅ | Cryoglobulinemia |
| 23 | exact | Hand, Foot, and Mouth Disease (HFMD) | ✅ | ✅ | ✅ | Hand, Foot, and Mouth Disease (HFMD) |
| 24 | exact | Aortic Valve Stenosis | ✅ | ✅ | ✅ | Aortic Valve Stenosis |
| 25 | exact | Eczema | ✅ | ✅ | ✅ | Eczema |
| 26 | exact | Rocio Encephalitis | ❌ | ✅ | ✅ | Murray Valley Encephalitis |
| 27 | exact | Hymenolepiasis (Dwarf Tapeworm) | ✅ | ✅ | ✅ | Hymenolepiasis (Dwarf Tapeworm) |
| 28 | exact | Shokwe Virus | ❌ | ❌ | ❌ | Tick-borne Encephalitis |
| 29 | exact | Hashimoto's Encephalopathy | ✅ | ✅ | ✅ | Hashimoto's Encephalopathy |
| 30 | exact | Mayaro Virus | ❌ | ✅ | ✅ | Bartonella Quintana Infection (Trench Fever) |
| 31 | exact | Adenovirus Infection | ✅ | ✅ | ✅ | Adenovirus Infection |
| 32 | exact | Enterobiasis (Pinworm) | ✅ | ✅ | ✅ | Enterobiasis (Pinworm) |
| 33 | exact | Type 2 Diabetes | ✅ | ✅ | ✅ | Type 2 Diabetes |
| 34 | exact | Oropouche Virus | ✅ | ✅ | ✅ | Oropouche Virus |
| 35 | exact | Emphysema (COPD Type) | ✅ | ✅ | ✅ | Emphysema (COPD Type) |
| 36 | exact | Human Metapneumovirus | ❌ | ✅ | ✅ | Parainfluenza Virus |
| 37 | exact | Onychomycosis (Nail Fungus) | ✅ | ✅ | ✅ | Onychomycosis (Nail Fungus) |
| 38 | exact | Chickenpox (Varicella) | ✅ | ✅ | ✅ | Chickenpox (Varicella) |
| 39 | exact | Porphyria | ✅ | ✅ | ✅ | Porphyria |
| 40 | exact | Chikungunya (Chronic Arthritis) | ✅ | ✅ | ✅ | Chikungunya (Chronic Arthritis) |
| 41 | partial | Sindbis Virus Disease (Ockelbo, Pogosta, Karelian Fever) | ❌ | ❌ | ❌ | Sagiyama Virus |
| 42 | partial | Scrub Typhus (Tsutsugamushi Disease) | ❌ | ❌ | ❌ | Tick-borne Lymphadenopathy |
| 43 | partial | Trichuriasis (Whipworm) | ❌ | ❌ | ❌ | Hymenolepiasis (Dwarf Tapeworm) |
| 44 | partial | Bourbon Virus Disease | ❌ | ❌ | ❌ | Tick-borne Encephalitis |
| 45 | partial | COPD | ✅ | ✅ | ✅ | COPD |
| 46 | partial | Chronic Obstructive Pulmonary Disease (COPD) | ❌ | ❌ | ❌ | COPD |
| 47 | partial | Clonorchiasis (Chinese Liver Fluke) | ❌ | ✅ | ✅ | Brugia malayi Infection |
| 48 | partial | Bronchitis (Acute) | ✅ | ✅ | ✅ | Bronchitis (Acute) |
| 49 | partial | Sagiyama Virus Infection | ❌ | ✅ | ✅ | Sagiyama Virus |
| 50 | partial | Pertussis (Whooping Cough) | ✅ | ✅ | ✅ | Pertussis (Whooping Cough) |
| 51 | typo | Coccidioidomycosis (Valley Fever) | ❌ | ✅ | ✅ | Melaka Virus Infection |
| 52 | typo | Kyungpook Virus Infection | ❌ | ❌ | ❌ | Babanki Virus |
| 53 | typo | Gout | ✅ | ✅ | ✅ | Gout |
| 54 | typo | Goiter | ✅ | ✅ | ✅ | Goiter |
| 55 | typo | Amyloidosis | ✅ | ✅ | ✅ | Amyloidosis |
| 56 | typo | Shokwe Virus | ❌ | ❌ | ✅ | Bunyamwera Virus |
| 57 | typo | Diphyllobothriasis (Broad Fish Tapeworm) | ❌ | ✅ | ✅ | Diphyllobothriasis (Fish Tapeworm) |
| 58 | typo | Rosacea | ✅ | ✅ | ✅ | Rosacea |
| 59 | typo | Getah Virus | ❌ | ❌ | ❌ | Igbo-Ora Virus |
| 60 | typo | Measles (Rubeola) | ✅ | ✅ | ✅ | Measles (Rubeola) |

---

## Methodology

- **Matcher**: `backend/matcher.py` — `EnhancedDiseaseMatcher.match_with_weights()`
- **Pre-processing**: `backend/utils.py` — `clean_symptoms()` (medical spell-checker + stop-word removal)
- **Top-k**: The expected disease must appear in the top-k results returned by the matcher
- **Test types**:
  - *Exact* — 3–5 of the disease's own symptoms used as input (40 cases)
  - *Partial* — only the first 2 symptoms used — harder (10 cases)
  - *Typo* — 1 symptom contains a deliberate character-level typo (10 cases)