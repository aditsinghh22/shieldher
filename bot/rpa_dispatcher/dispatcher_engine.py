import json
import logging
from pathlib import Path

# Placeholder imports for RPA modules (to be created)
from rpa_modules.cybercrime_gov import file_cybercrime_report
from rpa_modules.stopncii_org import file_stopncii_report
from rpa_modules.social_media import file_social_media_report

# Setup robust logging
logging.basicConfig(
    level=logging.INFO, 
    format='%(asctime)s - %(levelname)s - [%(name)s] - %(message)s'
)
logger = logging.getLogger("ShieldHer_Dispatcher")

def dispatch_complaint(payload: dict):
    """
    Main routing engine for the Autonomous Legal Dispatcher.
    Analyzes the payload and routes to the correct Playwright RPA script.
    """
    incident_details = payload.get("incident_details", {})
    incident_type = incident_details.get("incident_type", "")
    
    logger.info(f"Received payload for incident type: '{incident_type}'")

    if "Severe Harassment & Threats" in incident_type:
        logger.info("Routing to: National Cyber Crime Portal (General Report)")
        file_cybercrime_report(payload)
        
    elif "NCII & Deepfakes" in incident_type:
        logger.info("Routing to: StopNCII & National Cyber Crime Portal")
        # Ensure StopNCII is the primary action
        file_stopncii_report(payload)
        
    elif "Sextortion / Financial Fraud" in incident_type:
        logger.info("Routing to: National Cyber Crime Portal (Financial Fraud Focus)")
        file_cybercrime_report(payload, financial_focus=True)
        
    elif "Impersonation / Fake Profiles" in incident_type:
        logger.info("Routing to: Specific Social Media Platform Reporting")
        platform = incident_details.get("platform", "Instagram")
        file_social_media_report(payload, platform)
        
    else:
        logger.warning(f"Unknown incident type '{incident_type}'. Defaulting to general Cybercrime Portal.")
        file_cybercrime_report(payload)

if __name__ == "__main__":
    # Test the dispatcher with the mock payload
    payload_path = Path(__file__).parent / "test_payload.json"
    
    if payload_path.exists():
        with open(payload_path, "r") as f:
            try:
                payload = json.load(f)
                dispatch_complaint(payload)
            except json.JSONDecodeError:
                logger.error("Failed to parse test_payload.json")
    else:
        logger.error(f"Test payload not found at {payload_path}")
