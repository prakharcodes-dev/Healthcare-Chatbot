"""Pure health-metric status rules used by API and presentation services."""

def evaluate_health_metric_status(metric_type, val_pri, val_sec=None):
    metric_type = (metric_type or '').lower().strip()
    if metric_type == 'temperature':
        temp_f = val_pri * 9 / 5 + 32 if val_pri < 50 else val_pri
        if temp_f < 97.0: return 'Low'
        if temp_f <= 99.5: return 'Normal'
        if temp_f <= 102.0: return 'Elevated'
        return 'High'
    if metric_type == 'blood_pressure':
        systolic, diastolic = val_pri, val_sec if val_sec is not None else 80
        if systolic < 120 and diastolic < 80: return 'Normal'
        if 120 <= systolic <= 129 and diastolic < 80: return 'Elevated'
        if 130 <= systolic <= 139 or 80 <= diastolic <= 89: return 'High (Stage 1)'
        return 'High (Stage 2)'
    if metric_type == 'blood_glucose':
        if val_pri < 70: return 'Low'
        if val_pri <= 99: return 'Normal'
        if val_pri <= 125: return 'Elevated'
        return 'High'
    if metric_type == 'weight': return 'Normal'
    return 'Normal'
