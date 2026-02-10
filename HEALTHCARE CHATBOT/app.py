from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import uuid
import json
import os
from datetime import datetime
import threading
import webbrowser
import time

# ========== INITIALIZE FLASK APP ==========
app = Flask(__name__, static_folder='.', static_url_path='')

# Configure CORS - VERY IMPORTANT for frontend connection
CORS(app, resources={
    r"/*": {
        "origins": "*",
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

# Add CORS headers to all responses
@app.after_request
def add_cors_headers(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response

# ========== COMPREHENSIVE DISEASE DATASET ==========
DISEASE_DATABASE = [
    {
        "disease": "Lupus Erythematosus",
        "symptoms": ["butterfly-shaped facial rash", "fatigue", "fever", "joint pain/swelling", "skin lesions worsened by sun", "fingers/toes turning white/blue in cold", "shortness of breath", "chest pain", "dry eyes", "headaches", "confusion", "memory loss"],
        "category": "Autoimmune",
        "severity": "high"
    },
    {
        "disease": "Sjögren's Syndrome",
        "symptoms": ["dry eyes", "dry mouth", "dry skin", "vaginal dryness", "persistent cough", "swollen salivary glands", "joint pain/stiffness", "skin rashes", "prolonged fatigue"],
        "category": "Autoimmune",
        "severity": "moderate"
    },
    {
        "disease": "Scleroderma",
        "symptoms": ["hardening/tightening of skin", "Raynaud's phenomenon", "GERD", "swelling of hands/feet", "joint pain", "calcium deposits under skin", "narrowed blood vessels in hands/feet", "shortness of breath", "dry cough"],
        "category": "Autoimmune",
        "severity": "high"
    },
    {
        "disease": "Vasculitis",
        "symptoms": ["fever", "fatigue", "weight loss", "muscle/joint pain", "nerve problems", "weakness", "skin lesions/ulcers", "abdominal pain", "kidney problems", "vision changes"],
        "category": "Autoimmune",
        "severity": "high"
    },
    {
        "disease": "Sarcoidosis",
        "symptoms": ["fatigue", "fever", "swollen lymph nodes", "weight loss", "persistent dry cough", "shortness of breath", "wheezing", "chest pain", "skin rashes/lumps", "eye pain/redness/blurred vision"],
        "category": "Autoimmune",
        "severity": "moderate"
    },
    {
        "disease": "Fibromyalgia",
        "symptoms": ["widespread pain", "fatigue", "sleep disturbances", "cognitive difficulties ('fibro fog')", "morning stiffness", "headaches", "irritable bowel syndrome", "depression/anxiety", "numbness/tingling"],
        "category": "Chronic Pain",
        "severity": "moderate"
    },
    {
        "disease": "Chronic Fatigue Syndrome",
        "symptoms": ["severe fatigue not improved by rest", "post-exertional malaise", "sleep problems", "cognitive impairment", "orthostatic intolerance", "muscle/joint pain", "headaches", "sore throat", "tender lymph nodes"],
        "category": "Chronic",
        "severity": "moderate"
    },
    {
        "disease": "Endometriosis",
        "symptoms": ["painful periods", "chronic pelvic pain", "pain during intercourse", "pain with bowel movements/urination", "excessive bleeding", "infertility", "fatigue", "bloating", "nausea"],
        "category": "Reproductive",
        "severity": "moderate"
    },
    {
        "disease": "Polycystic Ovary Syndrome",
        "symptoms": ["irregular periods", "excess androgen", "polycystic ovaries", "weight gain", "excess hair growth", "acne", "male-pattern baldness", "darkening of skin", "headaches", "infertility"],
        "category": "Endocrine",
        "severity": "moderate"
    },
    {
        "disease": "Uterine Fibroids",
        "symptoms": ["heavy menstrual bleeding", "prolonged periods", "pelvic pressure/pain", "frequent urination", "difficulty emptying bladder", "constipation", "back/leg pain", "pain during intercourse"],
        "category": "Reproductive",
        "severity": "moderate"
    },
    {
        "disease": "Prostate Cancer",
        "symptoms": ["difficulty urinating", "decreased force in urine stream", "blood in urine/semen", "bone pain", "unexplained weight loss", "erectile dysfunction"],
        "category": "Cancer",
        "severity": "high"
    },
    {
        "disease": "Breast Cancer",
        "symptoms": ["breast lump/thickening", "change in breast size/shape", "dimpling of skin", "inverted nipple", "redness/pitting of breast skin", "nipple discharge", "breast/nipple pain", "swelling in armpit"],
        "category": "Cancer",
        "severity": "high"
    },
    {
        "disease": "Lung Cancer",
        "symptoms": ["persistent cough", "coughing up blood", "chest pain", "hoarseness", "weight loss", "shortness of breath", "fatigue", "wheezing", "repeated bronchitis/pneumonia"],
        "category": "Cancer",
        "severity": "high"
    },
    {
        "disease": "Colorectal Cancer",
        "symptoms": ["persistent change in bowel habits", "blood in stool", "persistent abdominal discomfort", "feeling bowel doesn't empty completely", "weakness/fatigue", "unexplained weight loss"],
        "category": "Cancer",
        "severity": "high"
    },
    {
        "disease": "Pancreatic Cancer",
        "symptoms": ["abdominal pain radiating to back", "loss of appetite", "unintended weight loss", "jaundice", "dark urine", "light-colored stools", "new-onset diabetes", "blood clots", "fatigue"],
        "category": "Cancer",
        "severity": "high"
    },
    {
        "disease": "Ovarian Cancer",
        "symptoms": ["abdominal bloating", "quickly feeling full", "weight loss", "pelvic discomfort", "changes in bowel habits", "frequent urination", "fatigue", "back pain"],
        "category": "Cancer",
        "severity": "high"
    },
    {
        "disease": "Cervical Cancer",
        "symptoms": ["vaginal bleeding after intercourse", "watery/bloody vaginal discharge", "pelvic pain", "pain during intercourse", "bleeding between periods/menopause"],
        "category": "Cancer",
        "severity": "high"
    },
    {
        "disease": "Testicular Cancer",
        "symptoms": ["lump/enlargement in testicle", "feeling of heaviness in scrotum", "dull ache in abdomen/groin", "sudden fluid collection in scrotum", "back pain", "breast tenderness/enlargement"],
        "category": "Cancer",
        "severity": "high"
    },
    {
        "disease": "Melanoma",
        "symptoms": ["new mole/changes in existing mole", "asymmetrical mole", "irregular borders", "color changes", "diameter >6mm", "evolving size/shape/color", "itching/bleeding"],
        "category": "Cancer",
        "severity": "high"
    },
    {
        "disease": "Non-Hodgkin Lymphoma",
        "symptoms": ["swollen lymph nodes", "abdominal pain/swelling", "chest pain/coughing", "fatigue", "fever", "night sweats", "weight loss"],
        "category": "Cancer",
        "severity": "high"
    },
    {
        "disease": "Hodgkin Lymphoma",
        "symptoms": ["painless swelling of lymph nodes", "fatigue", "fever", "night sweats", "weight loss", "severe itching", "pain in lymph nodes after alcohol", "shortness of breath"],
        "category": "Cancer",
        "severity": "high"
    },
    {
        "disease": "Multiple Myeloma",
        "symptoms": ["bone pain (especially back/ribs)", "fatigue", "frequent infections", "unexplained fractures", "excessive thirst", "frequent urination", "constipation", "loss of appetite", "confusion"],
        "category": "Cancer",
        "severity": "high"
    },
    {
        "disease": "Bladder Cancer",
        "symptoms": ["blood in urine", "painful urination", "frequent urination", "urgency", "pelvic pain", "back pain", "unexplained weight loss"],
        "category": "Cancer",
        "severity": "high"
    },
    {
        "disease": "Kidney Cancer",
        "symptoms": ["blood in urine", "persistent back pain", "loss of appetite", "unexplained weight loss", "fatigue", "fever", "lump in abdomen", "swelling in ankles/legs"],
        "category": "Cancer",
        "severity": "high"
    },
    {
        "disease": "Liver Cancer",
        "symptoms": ["unintended weight loss", "loss of appetite", "upper abdominal pain", "nausea/vomiting", "fatigue", "abdominal swelling", "jaundice", "white/chalky stools"],
        "category": "Cancer",
        "severity": "high"
    },
    {
        "disease": "Esophageal Cancer",
        "symptoms": ["difficulty swallowing", "weight loss", "chest pain/pressure/burning", "worsening indigestion/heartburn", "coughing/hoarseness", "vomiting", "bone pain"],
        "category": "Cancer",
        "severity": "high"
    },
    {
        "disease": "Stomach Cancer",
        "symptoms": ["difficulty swallowing", "abdominal pain", "feeling bloated after eating", "feeling full after small meals", "heartburn", "indigestion", "nausea", "unintended weight loss", "fatigue"],
        "category": "Cancer",
        "severity": "high"
    },
    {
        "disease": "Brain Tumor",
        "symptoms": ["new/worsening headaches", "nausea/vomiting", "vision problems", "seizures", "speech difficulties", "personality/behavior changes", "hearing problems", "balance problems", "memory problems"],
        "category": "Cancer",
        "severity": "high"
    },
    {
        "disease": "Thyroid Cancer",
        "symptoms": ["lump in neck", "hoarseness", "difficulty swallowing", "neck/throat pain", "swollen lymph nodes", "cough not from cold"],
        "category": "Cancer",
        "severity": "high"
    },
    {
        "disease": "Bone Cancer",
        "symptoms": ["bone pain", "swelling/tenderness near affected area", "weakened bones leading to fractures", "fatigue", "unintended weight loss"],
        "category": "Cancer",
        "severity": "high"
    },
    {
        "disease": "Osteoporosis",
        "symptoms": ["back pain (from fractured vertebra)", "loss of height over time", "stooped posture", "bone fractures from minor falls"],
        "category": "Bone",
        "severity": "moderate"
    },
    {
        "disease": "Osteomyelitis",
        "symptoms": ["fever", "pain in affected bone", "swelling/warmth/redness over affected area", "drainage of pus", "fatigue", "nausea", "reduced range of motion"],
        "category": "Bone",
        "severity": "high"
    },
    {
        "disease": "Paget's Disease of Bone",
        "symptoms": ["bone pain", "joint pain/stiffness", "enlarged/deformed bones", "fractures", "hearing loss", "headaches", "tingling/numbness"],
        "category": "Bone",
        "severity": "moderate"
    },
    {
        "disease": "Scoliosis",
        "symptoms": ["uneven shoulders", "one shoulder blade more prominent", "uneven waist", "one hip higher", "leaning to one side", "back pain", "fatigue"],
        "category": "Bone",
        "severity": "mild"
    },
    {
        "disease": "Carpal Tunnel Syndrome",
        "symptoms": ["tingling/numbness in thumb/index/middle fingers", "pain radiating up arm", "weakness in hand", "dropping objects", "worsening symptoms at night", "need to 'shake out' hand"],
        "category": "Musculoskeletal",
        "severity": "moderate"
    },
    {
        "disease": "Plantar Fasciitis",
        "symptoms": ["stabbing pain in bottom of heel", "pain worst with first steps in morning", "pain after prolonged standing", "heel stiffness", "pain worsens after exercise"],
        "category": "Musculoskeletal",
        "severity": "moderate"
    },
    {
        "disease": "Rotator Cuff Injury",
        "symptoms": ["dull ache deep in shoulder", "disturbed sleep", "difficulty reaching behind back", "arm weakness", "popping/clicking sounds with movement"],
        "category": "Musculoskeletal",
        "severity": "moderate"
    },
    {
        "disease": "Tennis Elbow",
        "symptoms": ["pain/tenderness on outside of elbow", "pain worsens with gripping/lifting", "stiffness in elbow", "weakness in forearm", "pain radiating to wrist"],
        "category": "Musculoskeletal",
        "severity": "moderate"
    },
    {
        "disease": "Cataracts",
        "symptoms": ["clouded/blurred/dim vision", "increasing difficulty with night vision", "sensitivity to light/glare", "need for brighter light", "halos around lights", "frequent prescription changes", "fading/yellowing of colors", "double vision in one eye"],
        "category": "Eye",
        "severity": "moderate"
    },
    {
        "disease": "Glaucoma",
        "symptoms": ["gradual loss of peripheral vision", "tunnel vision in advanced stages", "severe eye pain", "nausea/vomiting", "red eyes", "halos around lights", "blurred vision", "headache"],
        "category": "Eye",
        "severity": "high"
    },
    {
        "disease": "Macular Degeneration",
        "symptoms": ["blurred/reduced central vision", "dark/blurred areas in central vision", "distortion of straight lines", "difficulty recognizing faces", "need for brighter light", "decreased color brightness"],
        "category": "Eye",
        "severity": "high"
    },
    {
        "disease": "Retinal Detachment",
        "symptoms": ["sudden appearance of floaters", "flashes of light in one/both eyes", "blurred vision", "gradual reduced peripheral vision", "curtain-like shadow over visual field"],
        "category": "Eye",
        "severity": "high"
    },
    {
        "disease": "Diabetic Retinopathy",
        "symptoms": ["floaters", "blurred vision", "fluctuating vision", "impaired color vision", "dark/empty areas in vision", "vision loss"],
        "category": "Eye",
        "severity": "high"
    },
    {
        "disease": "Conjunctivitis",
        "symptoms": ["redness in one/both eyes", "itching in one/both eyes", "gritty feeling", "discharge forming crust", "tearing", "light sensitivity"],
        "category": "Eye",
        "severity": "mild"
    },
    {
        "disease": "Blepharitis",
        "symptoms": ["watery eyes", "red eyes", "gritty/burning sensation", "eyelid redness/swelling", "itching", "crusting of eyelashes", "blurred vision", "sensitivity to light", "loss of eyelashes"],
        "category": "Eye",
        "severity": "mild"
    },
    {
        "disease": "Uveitis",
        "symptoms": ["eye redness", "eye pain", "light sensitivity", "blurred vision", "dark floating spots", "decreased vision"],
        "category": "Eye",
        "severity": "moderate"
    },
    {
        "disease": "Dry Eye Syndrome",
        "symptoms": ["stinging/burning sensation", "stringy mucus", "light sensitivity", "redness", "sensation of something in eye", "difficulty wearing contacts", "night driving problems", "watery eyes", "blurred vision", "eye fatigue"],
        "category": "Eye",
        "severity": "mild"
    },
    {
        "disease": "Otitis Media",
        "symptoms": ["ear pain", "difficulty sleeping", "tugging at ear", "crying more than usual", "fussiness", "hearing difficulties", "loss of balance", "fever", "fluid drainage", "headache", "loss of appetite"],
        "category": "Ear",
        "severity": "moderate"
    },
    {
        "disease": "Otitis Externa",
        "symptoms": ["ear itching", "ear redness", "mild discomfort", "drainage of clear fluid", "fullness feeling", "decreased hearing", "severe pain", "fever", "swollen lymph nodes"],
        "category": "Ear",
        "severity": "moderate"
    },
    {
        "disease": "Tinnitus",
        "symptoms": ["ringing", "buzzing", "roaring", "clicking", "hissing", "phantom sounds", "volume fluctuation", "hearing loss"],
        "category": "Ear",
        "severity": "moderate"
    },
    {
        "disease": "Meniere's Disease",
        "symptoms": ["recurrent vertigo", "hearing loss", "tinnitus", "fullness in ear", "nausea/vomiting during attacks", "sweating", "headaches", "abdominal pain"],
        "category": "Ear",
        "severity": "moderate"
    },
    {
        "disease": "Vertigo",
        "symptoms": ["spinning sensation", "tilting/swaying", "unbalanced feeling", "nausea", "vomiting", "abnormal eye movements", "headache", "sweating", "ringing in ears", "hearing loss"],
        "category": "Neurological",
        "severity": "moderate"
    },
    {
        "disease": "Sinusitis",
        "symptoms": ["nasal congestion", "thick/discolored nasal discharge", "postnasal drip", "facial pain/pressure", "reduced sense of smell/taste", "cough", "fatigue", "fever", "headache", "bad breath", "tooth pain", "ear pressure"],
        "category": "Respiratory",
        "severity": "moderate"
    },
    {
        "disease": "Rhinitis",
        "symptoms": ["sneezing", "runny nose", "stuffy nose", "itchy nose/eyes/throat", "coughing", "postnasal drip", "fatigue"],
        "category": "Respiratory",
        "severity": "mild"
    },
    {
        "disease": "Deviated Septum",
        "symptoms": ["nasal congestion", "frequent nosebleeds", "facial pain", "noisy breathing during sleep", "preference for sleeping on particular side", "awareness of nasal cycle"],
        "category": "Respiratory",
        "severity": "mild"
    },
    {
        "disease": "Nasal Polyps",
        "symptoms": ["runny nose", "persistent stuffiness", "postnasal drip", "decreased sense of smell", "loss of taste", "facial pain", "headache", "snoring", "itching around eyes"],
        "category": "Respiratory",
        "severity": "moderate"
    },
    {
        "disease": "Sleep Apnea",
        "symptoms": ["loud snoring", "episodes of stopped breathing", "gasping for air during sleep", "awakening with dry mouth", "morning headache", "insomnia", "excessive daytime sleepiness", "difficulty paying attention", "irritability"],
        "category": "Sleep",
        "severity": "moderate"
    },
    {
        "disease": "Insomnia",
        "symptoms": ["difficulty falling asleep", "waking up during night", "waking up too early", "not feeling rested", "daytime tiredness", "irritability", "difficulty paying attention", "increased errors/accidents", "worry about sleep"],
        "category": "Sleep",
        "severity": "moderate"
    },
    {
        "disease": "Narcolepsy",
        "symptoms": ["excessive daytime sleepiness", "sudden loss of muscle tone", "sleep paralysis", "hallucinations", "disturbed nighttime sleep", "automatic behaviors", "memory problems"],
        "category": "Sleep",
        "severity": "moderate"
    },
    {
        "disease": "Restless Legs Syndrome",
        "symptoms": ["uncomfortable sensations in legs", "urge to move legs", "worsening symptoms at rest", "nighttime worsening", "leg twitching during sleep", "daytime sleepiness"],
        "category": "Sleep",
        "severity": "moderate"
    },
    {
        "disease": "Periodic Limb Movement Disorder",
        "symptoms": ["repetitive cramping/jerking of legs during sleep", "excessive daytime sleepiness", "frequent awakenings", "bed partner complaints", "kicking movements"],
        "category": "Sleep",
        "severity": "moderate"
    },
    {
        "disease": "Circadian Rhythm Disorders",
        "symptoms": ["insomnia", "excessive daytime sleepiness", "difficulty waking up", "poor school/work performance", "inability to meet social obligations", "depression", "stress in relationships"],
        "category": "Sleep",
        "severity": "moderate"
    },
    {
        "disease": "Parasomnias",
        "symptoms": ["sleepwalking", "sleep talking", "night terrors", "confusional arousals", "sleep-related eating", "REM sleep behavior disorder", "sleep paralysis"],
        "category": "Sleep",
        "severity": "moderate"
    },
    {
        "disease": "Hemorrhoids",
        "symptoms": ["itching/irritation in anal region", "pain/discomfort", "swelling around anus", "bleeding", "sensitive/lump near anus", "leakage of feces"],
        "category": "Gastrointestinal",
        "severity": "mild"
    },
    {
        "disease": "Anal Fissure",
        "symptoms": ["pain during bowel movements", "pain after bowel movements", "blood on stool/toilet paper", "visible crack in skin around anus", "itching/irritation"],
        "category": "Gastrointestinal",
        "severity": "moderate"
    },
    {
        "disease": "Anal Abscess",
        "symptoms": ["constant throbbing pain", "pain worsened by sitting/moving", "irritability", "fatigue", "fever", "chills", "swelling around anus", "constipation", "painful bowel movements"],
        "category": "Gastrointestinal",
        "severity": "high"
    },
    {
        "disease": "Anal Fistula",
        "symptoms": ["skin irritation around anus", "constant pain", "pain worsened by sitting/moving/bowel movements", "bleeding", "fever", "chills", "fatigue", "redness/swelling", "pus drainage"],
        "category": "Gastrointestinal",
        "severity": "moderate"
    },
    {
        "disease": "Diverticulitis",
        "symptoms": ["abdominal pain (usually left lower)", "fever", "nausea/vomiting", "abdominal tenderness", "constipation/diarrhea", "rectal bleeding", "bloating", "loss of appetite"],
        "category": "Gastrointestinal",
        "severity": "high"
    },
    {
        "disease": "Diverticulosis",
        "symptoms": ["often asymptomatic", "mild cramping", "bloating", "constipation", "rectal bleeding", "painful bowel movements"],
        "category": "Gastrointestinal",
        "severity": "mild"
    },
    {
        "disease": "Pancreatitis",
        "symptoms": ["upper abdominal pain", "abdominal pain radiating to back", "abdominal pain worse after eating", "fever", "rapid pulse", "nausea/vomiting", "tenderness when touching abdomen"],
        "category": "Gastrointestinal",
        "severity": "high"
    },
    {
        "disease": "Gallstones",
        "symptoms": ["sudden/intensifying pain in upper right abdomen", "back pain between shoulder blades", "right shoulder pain", "nausea/vomiting", "fever/chills", "jaundice", "clay-colored stools"],
        "category": "Gastrointestinal",
        "severity": "moderate"
    },
    {
        "disease": "Cholecystitis",
        "symptoms": ["severe pain in upper right abdomen", "pain radiating to right shoulder/back", "tenderness over abdomen", "nausea/vomiting", "fever", "bloating", "jaundice"],
        "category": "Gastrointestinal",
        "severity": "high"
    },
    {
        "disease": "Cirrhosis",
        "symptoms": ["fatigue", "easy bruising/bleeding", "jaundice", "fluid accumulation in abdomen", "loss of appetite", "nausea", "swelling in legs", "weight loss", "itchy skin", "spider-like blood vessels", "confusion/drowsiness", "slurred speech"],
        "category": "Liver",
        "severity": "high"
    },
    {
        "disease": "Pancreatic Insufficiency",
        "symptoms": ["diarrhea", "weight loss", "steatorrhea", "abdominal pain/cramps", "gas/bloating", "fatigue", "frequent infections", "bone pain", "muscle cramps"],
        "category": "Gastrointestinal",
        "severity": "moderate"
    },
    {
        "disease": "Cystic Fibrosis",
        "symptoms": ["persistent cough with thick mucus", "wheezing", "shortness of breath", "frequent lung infections", "nasal polyps", "poor growth/weight gain", "greasy foul-smelling stools", "intestinal blockage", "chronic/severe constipation", "male infertility"],
        "category": "Genetic",
        "severity": "high"
    },
    {
        "disease": "Alpha-1 Antitrypsin Deficiency",
        "symptoms": ["shortness of breath", "wheezing", "reduced exercise ability", "chronic cough", "frequent respiratory infections", "fatigue", "rapid heartbeat upon standing", "vision problems", "unintended weight loss"],
        "category": "Genetic",
        "severity": "high"
    },
    {
        "disease": "Pulmonary Embolism",
        "symptoms": ["sudden shortness of breath", "chest pain worse with breathing", "cough (may produce bloody sputum)", "leg pain/swelling", "fever", "excessive sweating", "rapid/irregular heartbeat", "lightheadedness/dizziness"],
        "category": "Respiratory",
        "severity": "high"
    },
    {
        "disease": "Pulmonary Hypertension",
        "symptoms": ["shortness of breath during activity", "fatigue", "chest pain", "racing heartbeat", "pain in upper right abdomen", "decreased appetite", "dizziness/fainting", "swelling in ankles/legs", "bluish lips/skin"],
        "category": "Cardiovascular",
        "severity": "high"
    },
    {
        "disease": "Pulmonary Fibrosis",
        "symptoms": ["shortness of breath", "dry cough", "fatigue", "unexplained weight loss", "aching muscles/joints", "widening/rounding of fingertips"],
        "category": "Respiratory",
        "severity": "high"
    },
    {
        "disease": "Bronchiectasis",
        "symptoms": ["daily cough with large amounts of sputum", "shortness of breath", "chest pain", "coughing up blood", "wheezing", "clubbing of fingers", "fatigue", "weight loss", "frequent respiratory infections"],
        "category": "Respiratory",
        "severity": "moderate"
    },
    {
        "disease": "Cystitis",
        "symptoms": ["strong persistent urge to urinate", "burning sensation when urinating", "passing frequent small amounts of urine", "blood in urine", "pelvic discomfort", "low-grade fever"],
        "category": "Urinary",
        "severity": "moderate"
    },
    {
        "disease": "Prostatitis",
        "symptoms": ["pain/burning during urination", "difficulty urinating", "frequent urination", "urgent need to urinate", "cloudy urine", "blood in urine", "pelvic pain", "painful ejaculation", "flu-like symptoms"],
        "category": "Urinary",
        "severity": "moderate"
    },
    {
        "disease": "Pyelonephritis",
        "symptoms": ["fever", "chills", "back/side/groin pain", "abdominal pain", "frequent urination", "strong persistent urge to urinate", "burning/painful urination", "nausea/vomiting", "pus/blood in urine", "foul-smelling urine"],
        "category": "Urinary",
        "severity": "high"
    },
    {
        "disease": "Glomerulonephritis",
        "symptoms": ["pink/cola-colored urine", "foamy urine", "high blood pressure", "fluid retention", "fatigue", "nausea/vomiting", "loss of appetite", "muscle cramps", "itching"],
        "category": "Kidney",
        "severity": "high"
    },
    {
        "disease": "Interstitial Cystitis",
        "symptoms": ["chronic pelvic pain", "pain between anus/vagina/scrotum", "persistent urgent need to urinate", "frequent urination", "pain during sexual intercourse", "pain in penis/scrotum", "pain worsens during menstrual period"],
        "category": "Urinary",
        "severity": "moderate"
    },
    {
        "disease": "Overactive Bladder",
        "symptoms": ["sudden urge to urinate", "urge incontinence", "frequent urination", "nocturia"],
        "category": "Urinary",
        "severity": "moderate"
    },
    {
        "disease": "Neurogenic Bladder",
        "symptoms": ["urinary incontinence", "frequent urination", "urgency", "urinary retention", "recurrent UTIs", "kidney stones"],
        "category": "Neurological",
        "severity": "moderate"
    },
    {
        "disease": "Hydronephrosis",
        "symptoms": ["pain in side/back", "urinary symptoms", "nausea/vomiting", "fever", "failure to thrive in infants", "urinary tract infections"],
        "category": "Kidney",
        "severity": "moderate"
    },
    {
        "disease": "Polycystic Kidney Disease",
        "symptoms": ["high blood pressure", "back/side pain", "headache", "increased abdominal size", "blood in urine", "kidney stones", "kidney failure", "UTIs"],
        "category": "Genetic",
        "severity": "high"
    },
    {
        "disease": "Nephrotic Syndrome",
        "symptoms": ["severe swelling around eyes/ankles/feet", "foamy urine", "weight gain from fluid retention", "fatigue", "loss of appetite"],
        "category": "Kidney",
        "severity": "high"
    },
    {
        "disease": "Renal Artery Stenosis",
        "symptoms": ["high blood pressure", "bruit over kidneys", "decreased kidney function", "fluid retention", "headaches", "confusion", "blurred vision", "nausea/vomiting"],
        "category": "Cardiovascular",
        "severity": "moderate"
    },
    {
        "disease": "Acute Kidney Injury",
        "symptoms": ["decreased urine output", "fluid retention", "shortness of breath", "fatigue", "confusion", "nausea/vomiting", "chest pain/pressure", "seizures/coma in severe cases"],
        "category": "Kidney",
        "severity": "high"
    },
    {
        "disease": "Hemochromatosis",
        "symptoms": ["joint pain", "fatigue", "weakness", "weight loss", "abdominal pain", "loss of sex drive", "impotence", "heart problems", "diabetes", "gray/bronze skin color"],
        "category": "Genetic",
        "severity": "moderate"
    },
    {
        "disease": "Wilson's Disease",
        "symptoms": ["fatigue", "lack of appetite", "abdominal pain", "jaundice", "golden-brown eye discoloration", "fluid buildup in legs/abdomen", "speech/swallowing problems", "uncontrolled movements", "muscle stiffness", "personality changes", "anxiety", "psychosis"],
        "category": "Genetic",
        "severity": "high"
    },
    {
        "disease": "Porphyria",
        "symptoms": ["severe abdominal pain", "pain in chest/back/legs", "constipation/diarrhea", "nausea/vomiting", "muscle pain/tingling/weakness", "reddish urine", "mental changes", "seizures", "rapid heartbeat", "high blood pressure", "breathing problems"],
        "category": "Genetic",
        "severity": "high"
    },
    {
        "disease": "Gaucher Disease",
        "symptoms": ["abdominal complaints", "bone pain", "bone fractures", "fatigue", "easy bruising/bleeding", "enlarged liver/spleen", "seizures", "tremors", "swallowing difficulties"],
        "category": "Genetic",
        "severity": "high"
    },
    {
        "disease": "Niemann-Pick Disease",
        "symptoms": ["clumsiness", "difficulty walking", "excessive eye movements", "loss of motor skills", "learning difficulties", "seizures", "difficulty swallowing/eating", "recurrent pneumonia"],
        "category": "Genetic",
        "severity": "high"
    },
    {
        "disease": "Tay-Sachs Disease",
        "symptoms": ["loss of motor skills", "increased startle response", "seizures", "vision/hearing loss", "muscle weakness", "movement problems", "paralysis", "cherry-red spot in eye"],
        "category": "Genetic",
        "severity": "high"
    },
    {
        "disease": "Huntington's Disease",
        "symptoms": ["involuntary jerking/writhing movements", "muscle problems", "slow/abnormal eye movements", "impaired gait/posture/balance", "difficulty swallowing", "slurred speech", "cognitive impairments", "difficulty organizing/prioritizing", "lack of flexibility", "lack of impulse control", "lack of awareness", "depression", "insomnia", "fatigue", "social withdrawal"],
        "category": "Genetic",
        "severity": "high"
    },
    {
        "disease": "Amyotrophic Lateral Sclerosis",
        "symptoms": ["difficulty walking", "tripping/falling", "leg/foot weakness", "hand weakness/clumsiness", "slurred speech", "difficulty swallowing", "muscle cramps", "twitching in arms/shoulders/tongue", "inappropriate crying/laughing", "cognitive changes"],
        "category": "Neurological",
        "severity": "high"
    },
    {
        "disease": "Muscular Dystrophy",
        "symptoms": ["frequent falls", "difficulty rising from lying/sitting", "trouble running/jumping", "waddling gait", "walking on toes", "large calf muscles", "muscle pain/stiffness", "learning disabilities", "delayed growth", "breathing problems", "curved spine", "heart problems"],
        "category": "Neurological",
        "severity": "high"
    },
    {
        "disease": "Myasthenia Gravis",
        "symptoms": ["drooping of one/both eyelids", "blurred/double vision", "impaired speech", "difficulty swallowing", "chewing problems", "facial paralysis", "weakness in neck/arms/legs", "shortness of breath"],
        "category": "Neurological",
        "severity": "moderate"
    },
    {
        "disease": "Guillain-Barré Syndrome",
        "symptoms": ["prickling/tingling in fingers/toes", "leg weakness spreading to upper body", "unsteady walking/inability to walk", "difficulty with eye/facial movements", "severe pain (especially at night)", "difficulty with bladder/bowel control", "rapid heart rate", "low/high blood pressure", "difficulty breathing"],
        "category": "Neurological",
        "severity": "high"
    },
    {
        "disease": "Peripheral Neuropathy",
        "symptoms": ["gradual numbness/tingling in feet/hands", "sharp/burning pain", "extreme sensitivity to touch", "pain during activities", "lack of coordination", "muscle weakness", "paralysis if motor nerves affected", "heat intolerance", "excessive sweating", "bowel/bladder problems"],
        "category": "Neurological",
        "severity": "moderate"
    },
    {
        "disease": "Trigeminal Neuralgia",
        "symptoms": ["sudden severe shooting/electric shock-like pain", "spontaneous attacks", "pain triggered by touching face/chewing/speaking/brushing teeth", "bouts lasting seconds to minutes", "pain in areas supplied by trigeminal nerve"],
        "category": "Neurological",
        "severity": "high"
    },
    {
        "disease": "Bell's Palsy",
        "symptoms": ["rapid onset mild weakness to total paralysis on one side of face", "facial droop/difficulty making facial expressions", "drooling", "pain around jaw/behind ear", "increased sensitivity to sound", "headache", "loss of taste", "changes in tear/saliva production"],
        "category": "Neurological",
        "severity": "moderate"
    },
    {
        "disease": "Cerebral Palsy",
        "symptoms": ["variations in muscle tone", "stiff muscles/exaggerated reflexes", "lack of muscle coordination", "tremors/involuntary movements", "slow writhing movements", "delays in motor skills", "favoring one side", "difficulty walking", "excessive drooling", "difficulty swallowing", "delayed speech development", "learning difficulties", "intellectual disability", "seizures", "abnormal touch/pain perception", "vision/hearing problems", "bladder/bowel problems", "mental health conditions"],
        "category": "Neurological",
        "severity": "high"
    },
    {
        "disease": "Spina Bifida",
        "symptoms": ["visible sac on back", "muscle weakness/paralysis", "orthopedic problems", "bowel/bladder problems", "seizures", "vision problems", "latex allergy", "sleep apnea", "skin problems", "hydrocephalus", "Chiari malformation", "learning disabilities"],
        "category": "Congenital",
        "severity": "high"
    },
    {
        "disease": "Hydrocephalus",
        "symptoms": ["unusually large head", "rapid increase in head size", "bulging soft spot", "vomiting", "sleepiness", "irritability", "poor feeding", "seizures", "eyes fixed downward", "developmental delays", "blurred/double vision", "abnormal eye movements", "problems with balance/coordination", "gait problems", "urinary incontinence", "cognitive changes", "memory loss", "poor concentration"],
        "category": "Neurological",
        "severity": "high"
    },
    {
        "disease": "Meningocele",
        "symptoms": ["visible sac on back", "clear fluid in sac", "paralysis", "bowel/bladder problems", "hydrocephalus", "learning disabilities"],
        "category": "Congenital",
        "severity": "high"
    },
    {
        "disease": "Encephalocele",
        "symptoms": ["protrusion of brain/membranes through skull", "hydrocephalus", "spastic quadriplegia", "microcephaly", "ataxia", "developmental delay", "vision problems", "mental/developmental delays", "seizures"],
        "category": "Congenital",
        "severity": "high"
    },
    {
        "disease": "Anencephaly",
        "symptoms": ["absence of major portions of brain/skull/scalp", "stillbirth", "death shortly after birth"],
        "category": "Congenital",
        "severity": "high"
    },
    {
        "disease": "Microcephaly",
        "symptoms": ["significantly smaller head size", "poor appetite", "high-pitched cry", "seizures", "developmental delays", "intellectual disability", "problems with movement/balance", "hearing loss", "vision problems", "dwarfism/short stature"],
        "category": "Congenital",
        "severity": "high"
    },
    {
        "disease": "Macrocephaly",
        "symptoms": ["larger than normal head circumference", "developmental delays", "learning disabilities", "seizures", "cortical thumbs", "optic nerve atrophy"],
        "category": "Congenital",
        "severity": "moderate"
    },
    {
        "disease": "Craniosynostosis",
        "symptoms": ["misshapen skull", "abnormal/fontanel", "hard ridge along sutures", "slow/no growth of head", "increased intracranial pressure", "developmental delays", "intellectual disability", "blindness", "seizures", "sleep apnea"],
        "category": "Congenital",
        "severity": "moderate"
    },
    {
        "disease": "Plagiocephaly",
        "symptoms": ["flattened appearance on one side of head", "bald spot on flattened area", "one ear appearing forward", "misaligned eyes", "jaw misalignment"],
        "category": "Congenital",
        "severity": "mild"
    },
    {
        "disease": "Torticollis",
        "symptoms": ["head tilted to one side", "chin tilted to opposite side", "limited range of motion", "headache", "neck pain", "uneven shoulders", "neck muscle swelling"],
        "category": "Musculoskeletal",
        "severity": "mild"
    },
    {
        "disease": "Spondylolisthesis",
        "symptoms": ["lower back pain", "muscle tightness", "pain/numbness/tingling in thighs/buttocks", "stiffness", "tenderness in affected area", "difficulty walking", "bladder/bowel problems in severe cases"],
        "category": "Musculoskeletal",
        "severity": "moderate"
    },
    {
        "disease": "Spinal Stenosis",
        "symptoms": ["numbness/weakness in leg/foot", "pain/cramping in legs when standing/walking", "back pain", "radiating pain", "loss of bladder/bowel control in severe cases"],
        "category": "Musculoskeletal",
        "severity": "moderate"
    },
    {
        "disease": "Herniated Disc",
        "symptoms": ["arm/leg pain", "numbness/tingling", "weakness", "pain worsened by certain movements", "pain radiating down sciatic nerve"],
        "category": "Musculoskeletal",
        "severity": "moderate"
    },
    {
        "disease": "Degenerative Disc Disease",
        "symptoms": ["pain worsened by sitting/bending/lifting", "pain improved by walking/moving", "pain improved by changing positions/lying down", "periods of severe pain", "numbness/tingling in extremities", "weakness in leg muscles"],
        "category": "Musculoskeletal",
        "severity": "moderate"
    },
    {
        "disease": "Septic Arthritis",
        "symptoms": ["severe joint pain", "joint swelling", "redness/warmth around joint", "fever", "chills", "inability to move affected joint", "guarding of joint"],
        "category": "Infectious",
        "severity": "high"
    },
    {
        "disease": "Osteochondritis Dissecans",
        "symptoms": ["joint pain", "joint swelling/tenderness", "joint popping/locking", "joint weakness", "decreased range of motion", "difficulty bearing weight"],
        "category": "Musculoskeletal",
        "severity": "moderate"
    },
    {
        "disease": "Avascular Necrosis",
        "symptoms": ["joint pain (initially mild)", "pain worsening over time", "limited range of motion", "pain even when lying down", "collapse of joint", "arthritis"],
        "category": "Musculoskeletal",
        "severity": "moderate"
    },
    {
        "disease": "Osteomalacia",
        "symptoms": ["bone pain", "muscle weakness", "difficulty walking", "bone fractures", "muscle cramps", "numbness around mouth", "numbness in arms/legs"],
        "category": "Bone",
        "severity": "moderate"
    },
    {
        "disease": "Rickets",
        "symptoms": ["delayed growth", "pain in spine/pelvis/legs", "muscle weakness", "bowed legs", "thickened wrists/ankles", "breastbone projection", "delayed motor skills", "enlarged ends of long bones"],
        "category": "Pediatric",
        "severity": "moderate"
    },
    {
        "disease": "Hyperparathyroidism",
        "symptoms": ["osteoporosis", "kidney stones", "excessive urination", "abdominal pain", "fatigue/weakness", "depression/forgetfulness", "bone/joint pain", "nausea/vomiting/loss of appetite", "frequent complaints of illness"],
        "category": "Endocrine",
        "severity": "moderate"
    },
    {
        "disease": "Hypoparathyroidism",
        "symptoms": ["tingling in lips/fingers/toes", "muscle aches/cramps", "muscle spasms", "fatigue/weakness", "painful menstruation", "patchy hair loss", "dry coarse skin", "brittle nails", "anxiety/depression", "memory problems", "headaches", "seizures"],
        "category": "Endocrine",
        "severity": "moderate"
    },
    {
        "disease": "Cushing's Syndrome",
        "symptoms": ["weight gain (especially face/trunk)", "pink/purple stretch marks", "thinning fragile skin", "slow healing of cuts/bruises", "acne", "fatigue", "muscle weakness", "cognitive difficulties", "high blood pressure", "bone loss", "type 2 diabetes", "increased infections"],
        "category": "Endocrine",
        "severity": "moderate"
    },
    {
        "disease": "Addison's Disease",
        "symptoms": ["extreme fatigue", "weight loss/decreased appetite", "hyperpigmentation", "low blood pressure", "salt craving", "hypoglycemia", "nausea/diarrhea/vomiting", "abdominal pain", "muscle/joint pain", "irritability", "depression", "body hair loss/sexual dysfunction in women"],
        "category": "Endocrine",
        "severity": "moderate"
    },
    {
        "disease": "Pheochromocytoma",
        "symptoms": ["high blood pressure", "severe headache", "sweating", "rapid heartbeat", "tremors", "paleness", "shortness of breath", "anxiety/nervousness", "weight loss", "heat intolerance"],
        "category": "Endocrine",
        "severity": "high"
    },
    {
        "disease": "Acromegaly",
        "symptoms": ["enlarged hands/feet", "coarsened enlarged facial features", "excessive sweating", "body odor", "skin tags", "fatigue/weakness", "deepened voice", "snoring/sleep apnea", "impaired vision", "headaches", "enlarged tongue", "joint pain", "menstrual irregularities", "erectile dysfunction", "enlarged organs"],
        "category": "Endocrine",
        "severity": "moderate"
    }
]

# Additional simple healthcare knowledge
HEALTHCARE_KNOWLEDGE = {
    "fever": {
        "response": """For fever: 
• Monitor your temperature regularly
• Rest and stay hydrated with water or electrolyte drinks
• Take paracetamol/acetaminophen as directed
• Use cool compresses on your forehead
• If fever is above 102°F (39°C) or lasts more than 3 days, consult a doctor
• Seek emergency care if fever is accompanied by rash, stiff neck, or confusion""",
        "severity": "moderate"
    },
    "headache": {
        "response": """For headaches:
• Rest in a quiet, dark room
• Apply cool compress to forehead or warm compress to neck
• Stay hydrated - drink plenty of water
• Consider over-the-counter pain relievers
• Practice relaxation techniques
• If headache is sudden, severe, or accompanied by vision changes, seek emergency care""",
        "severity": "mild"
    },
    "cold": {
        "response": """For common cold:
• Rest and get plenty of sleep
• Drink warm fluids (tea with honey, chicken soup)
• Use a humidifier to ease congestion
• Gargle with warm salt water for sore throat
• Symptoms usually improve in 7-10 days
• See a doctor if symptoms worsen or last more than 10 days""",
        "severity": "mild"
    },
    "cough": {
        "response": """For cough:
• Drink warm honey lemon water
• Use cough drops or lozenges
• Avoid irritants like smoke
• Use a humidifier at night
• If cough persists more than 3 weeks or causes breathing difficulty, consult a doctor""",
        "severity": "mild"
    },
    "stomach": {
        "response": """For stomach issues:
• Follow BRAT diet (bananas, rice, applesauce, toast)
• Avoid dairy, fatty, or spicy foods
• Stay hydrated with clear fluids
• If symptoms include severe pain or last more than 2 days, seek medical attention""",
        "severity": "moderate"
    },
    "pain": {
        "response": """For general pain:
• Rest the affected area
• Apply ice packs for acute injuries (first 48 hours)
• Use heat pads for muscle stiffness
• Consider over-the-counter pain relievers
• If pain is severe, worsening, or sudden, seek medical attention""",
        "severity": "varies"
    }
}

# ========== HELPER FUNCTIONS ==========
def match_symptoms_to_diseases(user_symptoms):
    """Match user symptoms to diseases in database"""
    matched_diseases = []
    user_symptoms_lower = [s.strip().lower() for s in user_symptoms]
    
    for disease in DISEASE_DATABASE:
        match_score = 0
        matched_symptoms = []
        
        for symptom in disease["symptoms"]:
            symptom_lower = symptom.lower()
            # Check if any user symptom matches this disease symptom
            for user_symptom in user_symptoms_lower:
                if user_symptom in symptom_lower or symptom_lower in user_symptom:
                    match_score += 1
                    matched_symptoms.append(symptom)
        
        if match_score > 0:
            # Calculate percentage match
            match_percentage = (match_score / len(disease["symptoms"])) * 100
            if match_percentage >= 20:  # At least 20% match
                matched_diseases.append({
                    "disease": disease["disease"],
                    "category": disease["category"],
                    "severity": disease["severity"],
                    "match_score": match_score,
                    "match_percentage": round(match_percentage, 1),
                    "matched_symptoms": matched_symptoms,
                    "all_symptoms": disease["symptoms"]
                })
    
    # Sort by match percentage (highest first)
    matched_diseases.sort(key=lambda x: x["match_percentage"], reverse=True)
    return matched_diseases[:5]  # Return top 5 matches

def detect_symptoms(user_message):
    """Detect symptoms from user message"""
    message_lower = user_message.lower()
    detected_symptoms = []
    
    # Extract symptoms from message
    symptom_words = message_lower.split()
    for disease in DISEASE_DATABASE:
        for symptom in disease["symptoms"]:
            symptom_lower = symptom.lower()
            if symptom_lower in message_lower:
                if symptom not in detected_symptoms:
                    detected_symptoms.append(symptom)
    
    return detected_symptoms

def generate_response(user_message, detected_symptoms):
    """Generate healthcare response based on detected symptoms"""
    
    # Check for greetings
    if any(word in user_message.lower() for word in ["hello", "hi", "hey", "greetings"]):
        hour = datetime.now().hour
        if hour < 12:
            greeting = "Good morning"
        elif hour < 18:
            greeting = "Good afternoon"
        else:
            greeting = "Good evening"
        
        return f"""{greeting}! 👋 I'm your advanced healthcare assistant.

🧠 **Knowledge Base**: {len(DISEASE_DATABASE)} diseases with detailed symptoms
🔍 **I can help you with**:
• Symptom analysis and possible condition matching
• Basic health guidance and first aid advice
• Information on when to see a doctor
• Disease information and symptom checking

💡 **Please describe your symptoms clearly**. For example:
• "I have fever and headache since yesterday"
• "Stomach pain with nausea and vomiting"
• "Joint pain, fatigue, and skin rash"
• "Persistent cough and shortness of breath"

How can I help you today?"""
    
    # Check for thanks
    if any(word in user_message.lower() for word in ["thank", "thanks", "appreciate"]):
        return "You're welcome! 😊 I'm glad I could help. Remember to always consult a healthcare professional for proper diagnosis and treatment. Take care!"
    
    # Check for emergency keywords
    emergency_keywords = ["emergency", "911", "urgent", "dying", "heart attack", "stroke", 
                         "can't breathe", "difficulty breathing", "chest pain", "severe pain",
                         "unconscious", "bleeding heavily", "broken bone"]
    if any(word in user_message.lower() for word in emergency_keywords):
        return """⚠️ **MEDICAL EMERGENCY ALERT** ⚠️

If you or someone else is experiencing:
• Chest pain or pressure
• Difficulty breathing or shortness of breath
• Severe bleeding that won't stop
• Sudden weakness, numbness, or paralysis
• Severe injury or trauma
• Loss of consciousness
• Seizures

🚨 **CALL EMERGENCY SERVICES (911/112/999) IMMEDIATELY** 🚨
Do not wait for chatbot response. Go to nearest emergency room."""

    # If symptoms detected, perform disease matching
    if detected_symptoms:
        matched_diseases = match_symptoms_to_diseases(detected_symptoms)
        
        if matched_diseases:
            response = f"🔍 **Based on your symptoms**, I found {len(matched_diseases)} possible condition(s):\n\n"
            
            for i, disease in enumerate(matched_diseases, 1):
                response += f"{i}. **{disease['disease']}** ({disease['category']})\n"
                response += f"   • Match: {disease['match_percentage']}%\n"
                response += f"   • Severity: {disease['severity'].upper()}\n"
                response += f"   • Matched symptoms: {', '.join(disease['matched_symptoms'][:5])}\n"
                if len(disease['matched_symptoms']) > 5:
                    response += f"   (and {len(disease['matched_symptoms']) - 5} more)\n"
                response += "\n"
            
            response += "📋 **Next Steps**:\n"
            response += "• Monitor your symptoms closely\n"
            response += "• Keep a symptom diary\n"
            response += "• Consult a healthcare professional for proper diagnosis\n"
            response += "• Do not self-diagnose or self-medicate\n\n"
            
            response += "⚠️ **Medical Disclaimer**:\n"
            response += "This is for informational purposes only. Not a substitute for professional medical advice.\n"
            response += "Always consult with a qualified healthcare provider for diagnosis and treatment."
            
            return response
        else:
            # Check for basic symptoms in HEALTHCARE_KNOWLEDGE
            message_lower = user_message.lower()
            for symptom, info in HEALTHCARE_KNOWLEDGE.items():
                if symptom in message_lower:
                    return info["response"] + "\n\n⚠️ **Remember**: This is general health information, not medical advice. Consult a doctor for proper diagnosis."
            
            return f"""I understand you're experiencing: **{', '.join(detected_symptoms[:5])}**

However, I couldn't find a strong match in my database. This could be because:
1. Symptoms may be too general
2. Multiple conditions share similar symptoms
3. More specific symptom description needed

💡 **Suggestions**:
• Be more specific about your symptoms (location, duration, intensity)
• Describe any other associated symptoms
• Mention when symptoms started and what makes them better/worse
• Consult a healthcare professional for accurate diagnosis

📞 **When to see a doctor**:
• Symptoms persist or worsen
• New symptoms develop
• You have concerns about your health"""
    
    # No symptoms detected
    return """I understand you're concerned about your health. Could you please describe your symptoms more specifically?

**For better assistance, please include**:
1. Main symptom(s) and location
2. When it started and how long it lasts
3. Severity (mild, moderate, severe)
4. What makes it better or worse
5. Any other associated symptoms

**Examples**:
• "I have had fever and body aches for 2 days"
• "Sharp stomach pain in lower right abdomen"
• "Persistent dry cough for 3 weeks"
• "Headache with sensitivity to light"

The more details you provide, the better I can assist you."""

# Conversation storage
conversations = {}

# ========== FRONTEND SERVING ==========
@app.route('/')
def serve_frontend():
    """Serve the chatbot interface"""
    return send_file('index.html')

@app.route('/health')
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "service": "Advanced Healthcare Chatbot",
        "disease_count": len(DISEASE_DATABASE),
        "categories": list(set([d["category"] for d in DISEASE_DATABASE])),
        "timestamp": datetime.now().isoformat()
    })

# ========== CHAT ENDPOINT ==========
@app.route('/chat', methods=['POST', 'OPTIONS'])
def chat():
    """Main chat endpoint"""
    # Handle CORS preflight
    if request.method == 'OPTIONS':
        return '', 200
    
    try:
        # Get request data
        data = request.get_json()
        user_message = data.get('message', '').strip()
        session_id = data.get('session_id')
        
        if not user_message:
            return jsonify({
                "response": "Please enter a message",
                "status": "error"
            }), 400
        
        # Create or use session
        if not session_id:
            session_id = str(uuid.uuid4())[:8]
        
        if session_id not in conversations:
            conversations[session_id] = []
        
        # Store user message
        conversations[session_id].append({
            "role": "user",
            "message": user_message,
            "timestamp": datetime.now().isoformat()
        })
        
        # Generate response
        detected_symptoms = detect_symptoms(user_message)
        response_text = generate_response(user_message, detected_symptoms)
        
        # Store bot response
        conversations[session_id].append({
            "role": "assistant", 
            "message": response_text,
            "timestamp": datetime.now().isoformat()
        })
        
        return jsonify({
            "response": response_text,
            "session_id": session_id,
            "status": "success",
            "symptoms_detected": detected_symptoms[:10],  # Limit to 10
            "symptoms_count": len(detected_symptoms)
        })
        
    except Exception as e:
        return jsonify({
            "response": f"Sorry, I encountered an error: {str(e)}",
            "status": "error"
        }), 500

# ========== NEW ENDPOINTS FOR DISEASE DATA ==========
@app.route('/diseases', methods=['GET'])
def get_diseases():
    """Get all diseases or filter by category"""
    category = request.args.get('category')
    
    if category:
        filtered_diseases = [d for d in DISEASE_DATABASE if d["category"].lower() == category.lower()]
        return jsonify({
            "category": category,
            "count": len(filtered_diseases),
            "diseases": filtered_diseases[:50]  # Limit response
        })
    
    # Return summary
    categories = {}
    for disease in DISEASE_DATABASE:
        cat = disease["category"]
        categories[cat] = categories.get(cat, 0) + 1
    
    return jsonify({
        "total_diseases": len(DISEASE_DATABASE),
        "categories": categories,
        "sample_diseases": DISEASE_DATABASE[:20]  # First 20 diseases
    })

@app.route('/diseases/search', methods=['GET'])
def search_diseases():
    """Search diseases by name or symptom"""
    query = request.args.get('q', '').lower()
    
    if not query:
        return jsonify({"error": "Please provide a search query"}), 400
    
    results = []
    
    for disease in DISEASE_DATABASE:
        # Search in disease name
        if query in disease["disease"].lower():
            results.append(disease)
            continue
        
        # Search in symptoms
        for symptom in disease["symptoms"]:
            if query in symptom.lower():
                results.append(disease)
                break
    
    return jsonify({
        "query": query,
        "count": len(results),
        "results": results[:20]  # Limit results
    })

# ========== AUTO-OPEN BROWSER ==========
def open_browser():
    """Open the default browser after a short delay"""
    time.sleep(1.5)  # Wait for server to start
    url = "http://localhost:5000"
    print(f"\n🌐 Opening chatbot in your browser: {url}")
    print("   If it doesn't open automatically, please open this URL manually")
    webbrowser.open(url)

# ========== START APPLICATION ==========
if __name__ == '__main__':
    # Display welcome message
    print("=" * 70)
    print("🏥 ADVANCED HEALTHCARE CHATBOT - WITH DISEASE DATABASE")
    print("=" * 70)
    print(f"\n📊 Disease Database Loaded: {len(DISEASE_DATABASE)} conditions")
    
    # Count by category
    categories = {}
    for disease in DISEASE_DATABASE:
        cat = disease["category"]
        categories[cat] = categories.get(cat, 0) + 1
    
    print("\n📁 Categories:")
    for cat, count in sorted(categories.items()):
        print(f"   • {cat}: {count} diseases")
    
    print("\n🚀 Starting services...")
    print("✅ Backend API: Running on port 5000")
    print("✅ Disease matching: Advanced symptom analysis")
    print("✅ Frontend UI: Served from same server")
    
    # Start browser in a separate thread
    browser_thread = threading.Thread(target=open_browser)
    browser_thread.daemon = True
    browser_thread.start()
    
    print("\n📡 Application URLs:")
    print("   • Main interface: http://localhost:5000")
    print("   • Chat endpoint:  http://localhost:5000/chat")
    print("   • Health check:   http://localhost:5000/health")
    print("   • Disease list:   http://localhost:5000/diseases")
    print("   • Disease search: http://localhost:5000/diseases/search?q=fever")
    
    print("\n⚡ Test commands:")
    print('   curl "http://localhost:5000/diseases?category=Cancer"')
    print('   curl "http://localhost:5000/diseases/search?q=headache"')
    
    print("\n🛑 Press Ctrl+C to stop the server")
    print("=" * 70)
    print("\nStarting server...\n")
    
    # Run the Flask app
    app.run(
        host='0.0.0.0',
        port=5000,
        debug=False,  # Set to False for cleaner output
        use_reloader=False
    )