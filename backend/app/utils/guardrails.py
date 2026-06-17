import re
import logging
from typing import Dict, Tuple

logger = logging.getLogger("guardrails")

class NeMoGuardrails:
    """
    Simulates NVIDIA NeMo Guardrails.
    Enforces policies on tone, word limits, and prohibited promotional language.
    """
    def __init__(self):
        # Define prohibited patterns (e.g., false guarantees, spam keywords)
        self.prohibited_patterns = [
            (re.compile(r"guarante(e|ed)\s+(#1|rank|result|google|success)", re.IGNORECASE), 
             "Prohibited guarantee of rank/results"),
            (re.compile(r"free!!!|act now|limited time|free cash|make money fast", re.IGNORECASE), 
             "Spam trigger words detected"),
        ]

    def validate_message(self, channel: str, message: str) -> Tuple[bool, str, str]:
        """
        Validates a message based on the channel's guardrails.
        Returns (is_valid, corrected_message, reason)
        """
        # Rule 1: Check prohibited language patterns
        for pattern, reason in self.prohibited_patterns:
            if pattern.search(message):
                # Auto-sanitize: remove the spammy phrase or replace
                sanitized = pattern.sub("[Professional growth opportunities]", message)
                logger.warning(f"NeMo Guardrails triggered for channel '{channel}': {reason}. Sanitizing.")
                return False, sanitized, reason

        # Rule 2: WhatsApp length limits (max 70 words)
        if channel.lower() == "whatsapp":
            word_count = len(message.split())
            if word_count > 70:
                logger.warning(f"NeMo Guardrails triggered for WhatsApp: Length exceeded {word_count} words (limit: 70). Truncating.")
                # Truncate and add professional signature
                words = message.split()[:65]
                truncated = " ".join(words) + "... Let's connect for details."
                return False, truncated, "WhatsApp word count limit (70) exceeded"

        return True, message, "Passed all safety guardrails"

    def apply_guardrails(self, outreach_messages: Dict[str, str]) -> Dict[str, str] :
        """
        Runs guardrails on a dictionary of channel messages and returns the compliant messages.
        """
        compliant_messages = {}
        for channel, msg in outreach_messages.items():
            _, safe_msg, _ = self.validate_message(channel, msg)
            compliant_messages[channel] = safe_msg
        return compliant_messages
